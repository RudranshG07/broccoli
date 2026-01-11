import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACTS, GPU_REGISTRY_ABI, JOB_MARKETPLACE_ABI } from "../config/contracts";
import type { GPU, Job } from "../types";
import { JobStatus, getJobStatusName } from "../types";
import { getIPFSGatewayUrl } from "../utils/ipfs";

interface Props {
  address: string;
}

export default function ConsumerDashboard({ address }: Props) {
  const [availableGPUs, setAvailableGPUs] = useState<(GPU & { id: number })[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Selected GPU for job posting
  const [selectedGpuId, setSelectedGpuId] = useState<number | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [computeHours, setComputeHours] = useState("");

  // NEW: Job type and code/image fields
  const [jobType, setJobType] = useState<"simple" | "python-script" | "docker-image">("simple");
  const [pythonCode, setPythonCode] = useState("");
  const [dockerImage, setDockerImage] = useState("");

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [minVram, setMinVram] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "vram" | "jobs">("price");

  // Calculate payment based on selected GPU's price and compute hours
  const selectedGpu = availableGPUs.find(g => g.id === selectedGpuId);
  const calculatedPayment = selectedGpu && computeHours
    ? (parseFloat(selectedGpu.pricePerHour) * parseFloat(computeHours)).toFixed(4)
    : "0";

  // Filter and sort GPUs
  const filteredGPUs = availableGPUs
    .filter(gpu => {
      const matchesSearch = gpu.model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVram = !minVram || gpu.vramGB >= parseInt(minVram);
      const matchesPrice = !maxPrice || parseFloat(gpu.pricePerHour) <= parseFloat(maxPrice);
      return matchesSearch && matchesVram && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === "price") return parseFloat(a.pricePerHour) - parseFloat(b.pricePerHour);
      if (sortBy === "vram") return b.vramGB - a.vramGB;
      if (sortBy === "jobs") return b.totalJobs - a.totalJobs;
      return 0;
    });

  const addNotification = (message: string) => {
    setNotifications((prev) => [message, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications((prev) => prev.slice(0, -1));
    }, 10000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const registryContract = new ethers.Contract(
        CONTRACTS.sepolia.gpuRegistry,
        GPU_REGISTRY_ABI,
        provider
      );
      const marketplaceContract = new ethers.Contract(
        CONTRACTS.sepolia.jobMarketplace,
        JOB_MARKETPLACE_ABI,
        provider
      );

      // Load available GPUs
      const gpuIds = await registryContract.getAvailableGPUs();
      const gpuData = await Promise.all(
        gpuIds.map(async (id: ethers.BigNumber) => {
          const gpu = await registryContract.getGPU(id);
          return {
            id: id.toNumber(),
            provider: gpu.provider,
            model: gpu.model,
            vramGB: gpu.vramGB.toNumber(),
            pricePerHour: ethers.utils.formatEther(gpu.pricePerHour),
            available: gpu.available,
            totalJobs: gpu.totalJobs.toNumber(),
            registeredAt: gpu.registeredAt.toNumber(),
          };
        })
      );
      setAvailableGPUs(gpuData);

      // Load my jobs
      const jobIds = await marketplaceContract.getConsumerJobs(address);
      const jobData = await Promise.all(
        jobIds.map(async (id: ethers.BigNumber) => {
          const job = await marketplaceContract.getJob(id);
          return {
            jobId: id.toNumber(),
            consumer: job.consumer,
            gpuId: job.gpuId.toNumber(),
            description: job.description,
            computeHours: job.computeHours.toNumber(),
            paymentAmount: ethers.utils.formatEther(job.paymentAmount),
            provider: job.provider,
            status: job.status,
            createdAt: job.createdAt.toNumber(),
            claimedAt: job.claimedAt.toNumber(),
            completedAt: job.completedAt.toNumber(),
            resultHash: job.resultHash,
          };
        })
      );
      setMyJobs(jobData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (CONTRACTS.sepolia.gpuRegistry !== "0x0000000000000000000000000000000000000000") {
      loadData();

      // Setup event listeners for real-time updates
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const marketplaceContract = new ethers.Contract(
        CONTRACTS.sepolia.jobMarketplace,
        JOB_MARKETPLACE_ABI,
        provider
      );

      // Listen for jobs posted by this consumer
      const jobPostedFilter = marketplaceContract.filters.JobPosted(null, address);
      marketplaceContract.on(jobPostedFilter, async (jobId, _consumer, _gpuId, paymentAmount) => {
        const ethAmount = ethers.utils.formatEther(paymentAmount);
        addNotification(`Job #${jobId.toNumber()} posted successfully! Payment ${ethAmount} ETH locked in escrow.`);
        await loadData();
      });

      // Listen for jobs claimed by providers
      const jobClaimedFilter = marketplaceContract.filters.JobClaimed();
      marketplaceContract.on(jobClaimedFilter, async (jobId, providerAddress) => {
        // Check if this job belongs to this consumer
        const job = await marketplaceContract.getJob(jobId);
        if (job.consumer.toLowerCase() === address.toLowerCase()) {
          addNotification(`Job #${jobId.toNumber()} claimed by provider ${providerAddress.slice(0, 10)}...! Work in progress.`);
          await loadData();
        }
      });

      // Listen for completed jobs
      const jobCompletedFilter = marketplaceContract.filters.JobCompleted();
      marketplaceContract.on(jobCompletedFilter, async (jobId, resultHash) => {
        // Check if this job belongs to this consumer
        const job = await marketplaceContract.getJob(jobId);
        if (job.consumer.toLowerCase() === address.toLowerCase()) {
          addNotification(`Job #${jobId.toNumber()} completed! Result: ${resultHash.slice(0, 20)}...`);
          await loadData();
        }
      });

      return () => {
        marketplaceContract.removeAllListeners();
      };
    }
  }, [address]);

  const postJob = async () => {
    if (selectedGpuId === null || !computeHours || calculatedPayment === "0") return;

    // Build job description based on type
    let fullDescription = jobDescription;

    if (jobType === "python-script") {
      if (!pythonCode.trim()) {
        alert("Please enter Python code");
        return;
      }
      // Encode as JSON in description field
      fullDescription = JSON.stringify({
        type: "python-script",
        description: jobDescription,
        code: pythonCode
      });
    } else if (jobType === "docker-image") {
      if (!dockerImage.trim()) {
        alert("Please enter Docker image URL");
        return;
      }
      fullDescription = JSON.stringify({
        type: "docker-image",
        description: jobDescription,
        image: dockerImage
      });
    } else {
      if (!jobDescription.trim()) {
        alert("Please enter job description");
        return;
      }
      fullDescription = JSON.stringify({
        type: "simple",
        description: jobDescription
      });
    }

    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACTS.sepolia.jobMarketplace,
        JOB_MARKETPLACE_ABI,
        signer
      );

      const tx = await contract.postJob(
        selectedGpuId,
        fullDescription,  // Contains type + code/image
        parseInt(computeHours),
        {
          value: ethers.utils.parseEther(calculatedPayment),
        }
      );
      await tx.wait();

      setSelectedGpuId(null);
      setJobDescription("");
      setComputeHours("");
      setPythonCode("");
      setDockerImage("");
      setJobType("simple");
      await loadData();
    } catch (error: any) {
      console.error("Failed to post job:", error);
      alert(`Failed to post job: ${error.message}`);
    } finally {
      setTxPending(false);
    }
  };

  const cancelJob = async (jobId: number) => {
    if (!confirm("Cancel this job? Payment will be refunded.")) return;

    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACTS.sepolia.jobMarketplace,
        JOB_MARKETPLACE_ABI,
        signer
      );

      const tx = await contract.cancelJob(jobId);
      await tx.wait();
      await loadData();
    } catch (error: any) {
      console.error("Failed to cancel job:", error);
      alert(`Failed to cancel job: ${error.message}`);
    } finally {
      setTxPending(false);
    }
  };

  // Parse job data from description
  const parseJobData = (description: string) => {
    try {
      return JSON.parse(description);
    } catch {
      return { type: "simple", description };
    }
  };

  if (CONTRACTS.sepolia.gpuRegistry === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="bg-green-900/20 border border-green-700 text-green-200 p-4 rounded-none">
        <strong>Contracts not deployed yet!</strong> Deploy the smart contracts to Sepolia and
        update the addresses in <code>frontend/src/config/contracts.ts</code>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 space-y-2 z-50 max-w-md">
          {notifications.map((notif, idx) => (
            <div
              key={idx}
              className="bg-green-600 text-white px-6 py-3 rounded-none shadow-lg border-2 border-[#00FF88] animate-pulse"
            >
              {notif}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center space-x-4 mb-8">
        <img src="/logo.png" alt="BroccoByte Logo" className="h-16 w-16 object-contain mix-blend-lighten" style={{backgroundColor: 'transparent'}} />
        <h2 className="text-3xl font-bold text-green-400">Consumer Dashboard</h2>
      </div>

      {/* Available GPUs - Same as before */}
      <div>
        <h3 className="text-2xl font-semibold mb-4">Available GPUs</h3>

        {/* Search and Filter Bar */}
        {availableGPUs.length > 0 && (
          <div className="mb-4 bg-gray-900 p-4 rounded-none border-2 border-[#00FF88]">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Search GPU model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white text-sm focus:border-[#00FF88] focus:outline-none"
              />
              <input
                type="number"
                placeholder="Min VRAM (GB)"
                value={minVram}
                onChange={(e) => setMinVram(e.target.value)}
                className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white text-sm focus:border-[#00FF88] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Max Price (ETH)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white text-sm focus:border-[#00FF88] focus:outline-none"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "price" | "vram" | "jobs")}
                className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white text-sm focus:border-[#00FF88] focus:outline-none"
              >
                <option value="price">Sort by Price (Low to High)</option>
                <option value="vram">Sort by VRAM (High to Low)</option>
                <option value="jobs">Sort by Experience</option>
              </select>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setMinVram("");
                  setMaxPrice("");
                  setSortBy("price");
                }}
                className="bg-gray-800 hover:bg-gray-700 text-[#00FF88] px-4 py-2 rounded-none text-sm border-2 border-[#00FF88] transition-all hover:shadow-lg hover:shadow-[#00FF88]/50"
              >
                Clear Filters
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Showing {filteredGPUs.length} of {availableGPUs.length} GPUs
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : availableGPUs.length === 0 ? (
          <div className="text-gray-400">No GPUs available at the moment</div>
        ) : filteredGPUs.length === 0 ? (
          <div className="text-gray-400">No GPUs match your filters</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGPUs.map((gpu) => {
              const gpuOccupied = myJobs.some(j => j.gpuId === gpu.id && j.status === JobStatus.Claimed);
              return (<div
                key={gpu.id}
                className={`bg-gray-900 p-4 rounded-none border-2 cursor-pointer transition-all ${
                  selectedGpuId === gpu.id
                    ? "border-[#00FF88] shadow-lg shadow-[#00FF88]/30"
                    : "border-transparent hover:border-[#00FF88]/50"
                }`}
                onClick={() => setSelectedGpuId(gpu.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-[#00FF88]">{gpu.model}</h4>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="px-2 py-1 rounded-none text-xs bg-green-600 border border-[#00FF88]">Available</span>
                    {gpuOccupied && (
                      <span className="px-2 py-1 rounded-none text-xs bg-green-600 border border-[#00FF88] animate-pulse">
                        Your Job Running
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm space-y-1 text-gray-300">
                  <div>VRAM: {gpu.vramGB} GB</div>
                  <div>Price: {gpu.pricePerHour} ETH/hour</div>
                  <div>Total Jobs Completed: {gpu.totalJobs}</div>
                  <div className="text-xs text-gray-500">
                    Provider: {gpu.provider.slice(0, 10)}...
                  </div>
                </div>
                {selectedGpuId === gpu.id && (
                  <div className="mt-2 text-sm text-[#00FF88] font-semibold">Selected</div>
                )}
              </div>);
            })}
          </div>
        )}
      </div>

      {/* Post Job Form - ENHANCED */}
      {selectedGpuId !== null && (
        <div className="bg-gray-900 p-6 rounded-none border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/20">
          <h3 className="text-xl font-semibold mb-4 text-[#00FF88]">Post New Job (GPU #{selectedGpuId})</h3>

          <div className="space-y-4">
            {/* Job Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Job Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setJobType("simple")}
                  className={`px-4 py-3 rounded-none border-2 transition-all ${
                    jobType === "simple"
                      ? "border-[#00FF88] bg-green-900/30 text-[#00FF88] shadow-lg shadow-[#00FF88]/30"
                      : "border-gray-700 hover:border-[#00FF88]/50 text-gray-400"
                  }`}
                >
                  <div className="font-semibold">Simple</div>
                  <div className="text-xs">Just description</div>
                </button>
                <button
                  onClick={() => setJobType("python-script")}
                  className={`px-4 py-3 rounded-none border-2 transition-all ${
                    jobType === "python-script"
                      ? "border-[#00FF88] bg-green-900/30 text-[#00FF88] shadow-lg shadow-[#00FF88]/30"
                      : "border-gray-700 hover:border-[#00FF88]/50 text-gray-400"
                  }`}
                >
                  <div className="font-semibold">Python Script</div>
                  <div className="text-xs">Submit code</div>
                </button>
                <button
                  onClick={() => setJobType("docker-image")}
                  className={`px-4 py-3 rounded-none border-2 transition-all ${
                    jobType === "docker-image"
                      ? "border-[#00FF88] bg-green-900/30 text-[#00FF88] shadow-lg shadow-[#00FF88]/30"
                      : "border-gray-700 hover:border-[#00FF88]/50 text-gray-400"
                  }`}
                >
                  <div className="font-semibold">Docker Image</div>
                  <div className="text-xs">From Docker Hub</div>
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <input
                type="text"
                placeholder="Brief description of your job"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white focus:border-[#00FF88] focus:outline-none"
              />
            </div>

            {/* Python Code Input */}
            {jobType === "python-script" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Python Code
                  <span className="text-xs text-gray-500 ml-2">(Provider will run this on their GPU)</span>
                </label>
                <textarea
                  value={pythonCode}
                  onChange={(e) => setPythonCode(e.target.value)}
                  placeholder={`import torch\nx = torch.randn(1000, 1000).cuda()\nresult = torch.matmul(x, x).sum().item()\nprint(f"RESULT:{result}")`}
                  className="w-full h-64 bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white font-mono text-sm focus:border-[#00FF88] focus:outline-none"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Tip: Print "RESULT:your_result" so provider can capture it
                </div>
              </div>
            )}

            {/* Docker Image Input */}
            {jobType === "docker-image" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Docker Image Name
                  <span className="text-xs text-gray-500 ml-2">(NOT the URL!)</span>
                </label>
                <input
                  type="text"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  placeholder="username/image-name"
                  className="w-full bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white font-mono focus:border-[#00FF88] focus:outline-none"
                />
                <div className="text-xs text-gray-400 mt-1 space-y-1">
                  <div>Correct: <span className="text-[#00FF88]">rudyg7/file-output-cpu</span></div>
                  <div>Wrong: <span className="text-red-400 line-through">https://hub.docker.com/r/rudyg7/file-output</span></div>
                  <div className="text-xs text-gray-500 mt-2">
                    Public images: nvidia/cuda:11.8.0-runtime-ubuntu22.04 or pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime
                  </div>
                </div>
              </div>
            )}

            {/* Compute Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Compute Hours</label>
              <input
                type="number"
                placeholder="How many hours of GPU time needed"
                value={computeHours}
                onChange={(e) => setComputeHours(e.target.value)}
                className="w-full bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white focus:border-[#00FF88] focus:outline-none"
              />
            </div>

            {/* Auto-calculated Payment Display */}
            {selectedGpu && (
              <div className="p-4 bg-black rounded-none border-2 border-[#00FF88]">
                <div className="text-sm text-gray-400 mb-2">Payment Calculation</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">GPU Hourly Rate</div>
                    <div className="text-white font-semibold">{selectedGpu.pricePerHour} ETH/hour</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Compute Hours</div>
                    <div className="text-white font-semibold">{computeHours || "0"}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Provider Earns (95%)</div>
                    <div className="text-[#00FF88] font-semibold">{(parseFloat(calculatedPayment) * 0.95).toFixed(4)} ETH</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Platform Fee (5%)</div>
                    <div className="text-gray-400 text-sm">{(parseFloat(calculatedPayment) * 0.05).toFixed(4)} ETH</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Payment:</span>
                    <span className="text-2xl font-bold text-[#00FF88]">{calculatedPayment} ETH</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={postJob}
              disabled={txPending || !computeHours || calculatedPayment === "0"}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white px-6 py-3 rounded-none font-medium disabled:opacity-50 text-lg border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/30 transition-all hover:shadow-xl hover:shadow-[#00FF88]/50"
            >
              {txPending ? "Processing..." : `Post Job & Pay ${calculatedPayment} ETH`}
            </button>
          </div>
        </div>
      )}

      {/* Current Jobs */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-[#00FF88]">Current Jobs</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : myJobs.filter(j => j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled).length === 0 ? (
          <div className="text-gray-400">No active jobs</div>
        ) : (
          <div className="space-y-4">
            {myJobs.filter(j => j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled).map((job) => {
              const jobData = parseJobData(job.description);
              const now = Math.floor(Date.now() / 1000);
              const timeElapsed = job.claimedAt > 0 ? now - job.claimedAt : 0;
              const totalSeconds = job.computeHours * 3600;
              const remainingSeconds = Math.max(0, totalSeconds - timeElapsed);
              const hoursLeft = Math.floor(remainingSeconds / 3600);
              const minutesLeft = Math.floor((remainingSeconds % 3600) / 60);
              const progress = job.claimedAt > 0 ? Math.min(100, (timeElapsed / totalSeconds) * 100) : 0;
              const providerEarnings = (parseFloat(job.paymentAmount) * 0.95).toFixed(4);
              const platformFee = (parseFloat(job.paymentAmount) * 0.05).toFixed(4);
              const timeWaiting = job.createdAt > 0 ? now - job.createdAt : 0;
              const waitingMinutes = Math.floor(timeWaiting / 60);

              return (
              <div key={job.jobId} className="bg-gray-900 p-6 rounded-none border-2 border-[#00FF88]/30 hover:border-[#00FF88] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-semibold text-[#00FF88]">Job #{job.jobId}</h4>
                      <span className="px-3 py-1 rounded-none text-xs bg-gray-700 text-gray-300 border border-gray-600">
                        {jobData.type || "simple"}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-none text-sm font-medium border ${
                          job.status === JobStatus.Open
                            ? "bg-green-600 border-[#00FF88]"
                            : job.status === JobStatus.Claimed
                            ? "bg-green-600 border-[#00FF88] animate-pulse"
                            : job.status === JobStatus.Completed
                            ? "bg-green-600 border-[#00FF88]"
                            : "bg-gray-600 border-gray-500"
                        }`}
                      >
                        {getJobStatusName(job.status)}
                      </span>
                    </div>
                    <p className="text-gray-300 text-lg mb-3">{jobData.description || job.description}</p>

                    {/* Show code/image preview */}
                    {jobData.type === "python-script" && jobData.code && (
                      <div className="mb-3 p-3 bg-black rounded-none border-2 border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">Python Code:</div>
                        <pre className="text-xs text-[#00FF88] font-mono overflow-x-auto max-h-32">
                          {jobData.code.substring(0, 200)}
                          {jobData.code.length > 200 && "..."}
                        </pre>
                      </div>
                    )}

                    {jobData.type === "docker-image" && jobData.image && (
                      <div className="mb-3 p-3 bg-black rounded-none border-2 border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">Docker Image:</div>
                        <div className="text-sm text-[#00FF88] font-mono">{jobData.image}</div>
                      </div>
                    )}

                    {/* Status-specific messages */}
                    {job.status === JobStatus.Open && (
                      <div className="mb-3 p-3 bg-green-900/30 rounded-none border-2 border-green-700 text-sm">
                        Waiting for provider to claim... ({waitingMinutes} minutes elapsed)
                      </div>
                    )}

                    {/* Time Progress Bar - For Claimed jobs */}
                    {job.status === JobStatus.Claimed && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Provider Working...</span>
                          <span className="text-green-400 font-semibold">
                            {remainingSeconds > 0
                              ? `${hoursLeft}h ${minutesLeft}m remaining`
                              : "Expected completion time passed"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-none h-3 border border-gray-700">
                          <div
                            className={`h-3 rounded-none transition-all ${
                              remainingSeconds > 0 ? "bg-gradient-to-r from-green-500 to-[#00FF88] animate-pulse" : "bg-green-700"
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-black rounded-none border border-[#00FF88]/30">
                      <div>
                        <div className="text-xs text-gray-500">Your Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ETH</div>
                        <div className="text-xs text-gray-500">
                          {job.status === JobStatus.Open && "Locked in escrow"}
                          {job.status === JobStatus.Claimed && "In escrow"}
                          {job.status === JobStatus.Completed && "Paid to provider"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Provider Gets (95%)</div>
                        <div className="text-lg font-semibold text-[#00FF88]">{providerEarnings} ETH</div>
                        <div className="text-xs text-gray-500">Platform: {platformFee} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU Used</div>
                        <div className="text-sm text-[#00FF88]">GPU #{job.gpuId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Compute Hours</div>
                        <div className="text-sm text-white">{job.computeHours}h</div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="mt-3 text-sm space-y-1 text-gray-400">
                      <div>Posted: {new Date(job.createdAt * 1000).toLocaleString()}</div>
                      {job.provider !== ethers.constants.AddressZero && (
                        <div>Provider: {job.provider.slice(0, 10)}...{job.provider.slice(-8)}</div>
                      )}
                      {job.claimedAt > 0 && (
                        <div>Claimed: {new Date(job.claimedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.completedAt > 0 && (
                        <div>Completed: {new Date(job.completedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.resultHash && (
                        <div className="text-[#00FF88] mt-2 p-2 bg-green-900/20 rounded-none border border-[#00FF88]">
                          <div className="text-xs text-gray-500 mb-1">Result:</div>
                          <span className="font-mono text-xs break-all">{job.resultHash}</span>
                          {job.resultHash.startsWith('ipfs://') && (
                            <div className="mt-2">
                              <a
                                href={getIPFSGatewayUrl(job.resultHash.replace('ipfs://', ''))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#00FF88] hover:text-green-300 underline font-semibold"
                              >
                                View Result on IPFS
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4">
                    {job.status === JobStatus.Open && (
                      <button
                        onClick={() => cancelJob(job.jobId)}
                        disabled={txPending}
                        className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white px-6 py-3 rounded-none font-medium disabled:opacity-50 border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/30 transition-all hover:shadow-xl hover:shadow-[#00FF88]/50"
                      >
                        Cancel Job<br/>
                        <span className="text-xs">Get refund</span>
                      </button>
                    )}
                    {job.status === JobStatus.Claimed && (
                      <div className="text-center p-3 bg-green-900/30 rounded-none border-2 border-[#00FF88]">
                        <div className="text-[#00FF88] font-semibold">In Progress</div>
                        <div className="text-xs text-gray-400 mt-1">Provider working</div>
                      </div>
                    )}
                    {job.status === JobStatus.Completed && (
                      <div className="text-center p-3 bg-green-900/30 rounded-none border-2 border-[#00FF88]">
                        <div className="text-[#00FF88] font-semibold">Completed!</div>
                        <div className="text-xs text-gray-400 mt-1">Check result</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Job History */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-[#00FF88]">Job History</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : myJobs.filter(j => j.status === JobStatus.Completed).length === 0 ? (
          <div className="text-gray-400">No completed jobs yet</div>
        ) : (
          <div className="space-y-4">
            {myJobs.filter(j => j.status === JobStatus.Completed).map((job) => {
              const jobData = parseJobData(job.description);
              const providerEarnings = (parseFloat(job.paymentAmount) * 0.95).toFixed(4);
              const platformFee = (parseFloat(job.paymentAmount) * 0.05).toFixed(4);

              return (
              <div key={job.jobId} className="bg-gray-900 p-6 rounded-none border-2 border-gray-700 opacity-90">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-semibold text-gray-400">Job #{job.jobId}</h4>
                      <span className="px-3 py-1 rounded-none text-xs bg-gray-700 text-gray-300 border border-gray-600">
                        {jobData.type || "simple"}
                      </span>
                      <span className="px-3 py-1 rounded-none text-sm font-medium border bg-green-600 border-[#00FF88]">
                        {getJobStatusName(job.status)}
                      </span>
                    </div>
                    <p className="text-gray-400 text-lg mb-3">{jobData.description || job.description}</p>

                    {/* Show code/image preview */}
                    {jobData.type === "python-script" && jobData.code && (
                      <div className="mb-3 p-3 bg-black rounded-none border-2 border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">Python Code:</div>
                        <pre className="text-xs text-gray-400 font-mono overflow-x-auto max-h-32">
                          {jobData.code.substring(0, 200)}
                          {jobData.code.length > 200 && "..."}
                        </pre>
                      </div>
                    )}

                    {jobData.type === "docker-image" && jobData.image && (
                      <div className="mb-3 p-3 bg-black rounded-none border-2 border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">Docker Image:</div>
                        <div className="text-sm text-gray-400 font-mono">{jobData.image}</div>
                      </div>
                    )}

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-black rounded-none border border-gray-700">
                      <div>
                        <div className="text-xs text-gray-500">Your Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ETH</div>
                        <div className="text-xs text-gray-500">Paid to provider</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Provider Got (95%)</div>
                        <div className="text-lg font-semibold text-[#00FF88]">{providerEarnings} ETH</div>
                        <div className="text-xs text-gray-500">Platform: {platformFee} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU Used</div>
                        <div className="text-sm text-gray-400">GPU #{job.gpuId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Compute Hours</div>
                        <div className="text-sm text-white">{job.computeHours}h</div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="mt-3 text-sm space-y-1 text-gray-500">
                      <div>Posted: {new Date(job.createdAt * 1000).toLocaleString()}</div>
                      {job.provider !== ethers.constants.AddressZero && (
                        <div>Provider: {job.provider.slice(0, 10)}...{job.provider.slice(-8)}</div>
                      )}
                      {job.claimedAt > 0 && (
                        <div>Claimed: {new Date(job.claimedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.completedAt > 0 && (
                        <div>Completed: {new Date(job.completedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.resultHash && (
                        <div className="text-[#00FF88] mt-2 p-2 bg-green-900/20 rounded-none border border-[#00FF88]">
                          <div className="text-xs text-gray-500 mb-1">Result:</div>
                          <span className="font-mono text-xs break-all">{job.resultHash}</span>
                          {job.resultHash.startsWith('ipfs://') && (
                            <div className="mt-2">
                              <a
                                href={getIPFSGatewayUrl(job.resultHash.replace('ipfs://', ''))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#00FF88] hover:text-green-300 underline font-semibold"
                              >
                                View Result on IPFS
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="ml-4">
                    <div className="text-center p-3 bg-green-900/30 rounded-none border-2 border-[#00FF88]">
                      <div className="text-[#00FF88] font-semibold">Completed</div>
                      <div className="text-xs text-gray-400 mt-1">Job finished</div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-800 flex items-center justify-center space-x-3 opacity-50">
        <img src="/logo.png" alt="BroccoByte" className="h-8 w-8 object-contain mix-blend-lighten" style={{backgroundColor: 'transparent'}} />
        <span className="text-sm text-gray-500">Powered by BroccoByte</span>
      </div>
    </div>
  );
}
