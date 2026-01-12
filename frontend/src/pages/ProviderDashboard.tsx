import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { GPU_REGISTRY_ABI, JOB_MARKETPLACE_ABI, getContracts } from "../config/contracts";
import type { GPU, Job } from "../types";
import { JobStatus, getJobStatusName } from "../types";
import { uploadJobResult, getIPFSGatewayUrl } from "../utils/ipfs";

interface Props {
  address: string;
  currentChainId: number;
}

export default function ProviderDashboard({ address, currentChainId }: Props) {
  const [gpus, setGpus] = useState<(GPU & { id: number })[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  const chainId = currentChainId;

  // Get currency symbol based on network
  const getCurrencySymbol = () => {
    return chainId === 8119 ? 'SHM' : 'ETH';
  };

  // Form state
  const [gpuModel, setGpuModel] = useState("");
  const [vram, setVram] = useState("");
  const [price, setPrice] = useState("");

  // GPU Worker state
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [executionLogs, setExecutionLogs] = useState<{[key: number]: string}>({});
  const [executionResults, setExecutionResults] = useState<{[key: number]: string}>({});

  // IPFS upload state
  const [uploadingToIPFS, setUploadingToIPFS] = useState<{[key: number]: boolean}>({});
  const [ipfsHashes, setIpfsHashes] = useState<{[key: number]: string}>({});

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
        getContracts(chainId).gpuRegistry,
        GPU_REGISTRY_ABI,
        provider
      );
      const marketplaceContract = new ethers.Contract(
        getContracts(chainId).jobMarketplace,
        JOB_MARKETPLACE_ABI,
        provider
      );

      // Load provider's GPUs
      const gpuIds = await registryContract.getProviderGPUs(address);
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
      // Filter out GPUs that have been removed (marked as unavailable)
      const activeGpus = gpuData.filter(gpu => gpu.available);
      setGpus(activeGpus);

      // Load provider's jobs
      const jobIds = await marketplaceContract.getProviderJobs(address);
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
      setJobs(jobData);

      // Load open jobs for provider's GPUs
      const myGpuIds = gpuData.map(g => g.id);
      const openJobIds = await marketplaceContract.getOpenJobs();
      const openJobsData = await Promise.all(
        openJobIds.map(async (id: ethers.BigNumber) => {
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
      // Filter for jobs that match provider's GPUs
      const jobsForMyGpus = openJobsData.filter(job => myGpuIds.includes(job.gpuId));
      setAvailableJobs(jobsForMyGpus);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chainId === 0) return; // Wait for chainId to be set
    if (getContracts(chainId).gpuRegistry !== "0x0000000000000000000000000000000000000000") {
      loadData();

      // Setup event listeners for real-time updates
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const marketplaceContract = new ethers.Contract(
        getContracts(chainId).jobMarketplace,
        JOB_MARKETPLACE_ABI,
        provider
      );

      // Listen for new jobs claimed by this provider
      const jobClaimedFilter = marketplaceContract.filters.JobClaimed(null, address);
      marketplaceContract.on(jobClaimedFilter, async (jobId, _provider) => {
        addNotification(`You claimed Job #${jobId.toNumber()}! Start working on it.`);
        await loadData();
      });

      // Listen for payment releases to this provider
      const paymentFilter = marketplaceContract.filters.PaymentReleased(null, address);
      marketplaceContract.on(paymentFilter, async (jobId, _provider, amount) => {
        const ethAmount = ethers.utils.formatEther(amount);
        addNotification(`Payment received: ${ethAmount} ${getCurrencySymbol()} for Job #${jobId.toNumber()}`);
        await loadData();
      });

      // Listen for completed jobs
      const jobCompletedFilter = marketplaceContract.filters.JobCompleted();
      marketplaceContract.on(jobCompletedFilter, async (_jobId) => {
        await loadData();
      });

      // Listen for new jobs posted (to update available jobs)
      const jobPostedFilter = marketplaceContract.filters.JobPosted();
      marketplaceContract.on(jobPostedFilter, async (_jobId, _consumer, gpuId) => {
        // Check if this job is for one of provider's GPUs
        const myGpuIds = gpus.map(g => g.id);
        if (myGpuIds.includes(gpuId.toNumber())) {
          addNotification(`New job available for your GPU #${gpuId.toNumber()}!`);
          await loadData();
        }
      });

      return () => {
        marketplaceContract.removeAllListeners();
      };
    }
  }, [address, chainId]);

  const registerGPU = async () => {
    if (!gpuModel || !vram || !price) return;

    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        getContracts(chainId).gpuRegistry,
        GPU_REGISTRY_ABI,
        signer
      );

      const tx = await contract.registerGPU(
        gpuModel,
        parseInt(vram),
        ethers.utils.parseEther(price)
      );
      await tx.wait();

      setGpuModel("");
      setVram("");
      setPrice("");
      await loadData();
    } catch (error: any) {
      console.error("Failed to register GPU:", error);
      alert(`Failed to register GPU: ${error.message}`);
    } finally {
      setTxPending(false);
    }
  };

  const toggleAvailability = async (gpuId: number, currentStatus: boolean) => {
    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        getContracts(chainId).gpuRegistry,
        GPU_REGISTRY_ABI,
        signer
      );

      const tx = await contract.setAvailability(gpuId, !currentStatus);
      await tx.wait();
      await loadData();
    } catch (error: any) {
      console.error("Failed to toggle availability:", error);
      alert(`Failed to toggle availability: ${error.message}`);
    } finally {
      setTxPending(false);
    }
  };

  const claimJob = async (jobId: number) => {
    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        getContracts(chainId).jobMarketplace,
        JOB_MARKETPLACE_ABI,
        signer
      );

      const tx = await contract.claimJob(jobId);
      await tx.wait();
      addNotification(`Successfully claimed Job #${jobId}! Start working on it.`);
      await loadData();
    } catch (error: any) {
      console.error("Failed to claim job:", error);
      alert(`Failed to claim job: ${error.message}`);
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

  // Run job with GPU worker
  const runJobWithGPU = async (job: Job) => {
    const jobData = parseJobData(job.description);
    setProcessingJobId(job.jobId);
    setExecutionLogs(prev => ({...prev, [job.jobId]: "Starting GPU worker...\n"}));

    try {
      // Check if worker is running
      const healthCheck = await fetch('http://localhost:3001/health').catch(() => null);
      if (!healthCheck) {
        throw new Error("GPU Worker not running. Start it with: cd provider-worker && npm start");
      }

      setExecutionLogs(prev => ({...prev, [job.jobId]: prev[job.jobId] + "Calling GPU worker...\n"}));

      // Call GPU worker
      const response = await fetch('http://localhost:3001/process-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.jobId,
          jobType: jobData.type || 'simple',
          jobData: jobData.type === 'python-script'
            ? { code: jobData.code }
            : jobData.type === 'docker-image'
            ? { image: jobData.image }
            : { description: jobData.description }
        })
      });

      const result = await response.json();

      if (result.success) {
        setExecutionLogs(prev => ({
          ...prev,
          [job.jobId]: prev[job.jobId] + "\n=== EXECUTION LOGS ===\n" + result.logs + "\n=== COMPLETE ===\n"
        }));
        setExecutionResults(prev => ({...prev, [job.jobId]: result.resultHash || result.result}));
        addNotification(`Job #${job.jobId} processed successfully! Result: ${result.result?.substring(0, 20)}...`);
      } else {
        throw new Error(result.error || "GPU processing failed");
      }
    } catch (error: any) {
      console.error("GPU Worker error:", error);
      setExecutionLogs(prev => ({
        ...prev,
        [job.jobId]: prev[job.jobId] + `\nERROR: ${error.message}\n`
      }));
      alert(`GPU Worker Error: ${error.message}`);
    } finally {
      setProcessingJobId(null);
    }
  };

  const uploadResultToIPFS = async (jobId: number) => {
    const logs = executionLogs[jobId] || "No execution logs";
    const result = executionResults[jobId] || "No result data";

    setUploadingToIPFS(prev => ({...prev, [jobId]: true}));

    try {
      const uploadResult = await uploadJobResult(jobId, logs, result);

      if (uploadResult.success && uploadResult.ipfsUrl) {
        setIpfsHashes(prev => ({...prev, [jobId]: uploadResult.ipfsUrl!}));
        setExecutionResults(prev => ({...prev, [jobId]: uploadResult.ipfsUrl!}));
        addNotification(`Job #${jobId} uploaded to IPFS: ${uploadResult.ipfsHash}`);

        // Show gateway URL for viewing
        const gatewayUrl = getIPFSGatewayUrl(uploadResult.ipfsHash!);
        console.log(`View on IPFS: ${gatewayUrl}`);
      } else {
        throw new Error(uploadResult.error || "Upload failed");
      }
    } catch (error: any) {
      console.error("IPFS upload error:", error);
      alert(`Failed to upload to IPFS: ${error.message}`);
    } finally {
      setUploadingToIPFS(prev => ({...prev, [jobId]: false}));
    }
  };

  const completeJob = async (jobId: number) => {
    // Use IPFS hash if available, then auto-generated result, otherwise ask
    let resultHash: string | null = ipfsHashes[jobId] || executionResults[jobId];

    if (!resultHash) {
      resultHash = prompt(
        "Enter result hash (proof of completed work):\n\n" +
        "Examples:\n" +
        "• IPFS: ipfs://QmXxXxXxX...\n" +
        "• URL: https://storage.com/results.zip\n" +
        "• Hash: 0x1234abcd...\n" +
        "• Demo: completed-job-" + jobId + "\n\n" +
        "For testing, you can enter any text:"
      );
    }

    if (!resultHash) return;

    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        getContracts(chainId).jobMarketplace,
        JOB_MARKETPLACE_ABI,
        signer
      );

      const tx = await contract.completeJob(jobId, resultHash);
      await tx.wait();

      // Clear execution data
      setExecutionLogs(prev => {
        const newLogs = {...prev};
        delete newLogs[jobId];
        return newLogs;
      });
      setExecutionResults(prev => {
        const newResults = {...prev};
        delete newResults[jobId];
        return newResults;
      });
      setIpfsHashes(prev => {
        const newHashes = {...prev};
        delete newHashes[jobId];
        return newHashes;
      });

      await loadData();
    } catch (error: any) {
      console.error("Failed to complete job:", error);
      alert(`Failed to complete job: ${error.message}`);
    } finally {
      setTxPending(false);
    }
  };

  if (getContracts(chainId).gpuRegistry === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-200 p-4 rounded-none">
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
        <h2 className="text-3xl font-bold text-[#00FF88]">Provider Dashboard</h2>
      </div>

      {/* Statistics Overview */}
      {!loading && gpus.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 p-4 rounded-none border-2 border-[#00FF88]">
            <div className="text-xs text-gray-500 mb-1">Total GPUs</div>
            <div className="text-2xl font-bold text-[#00FF88]">{gpus.length}</div>
            <div className="text-xs text-gray-400 mt-1">
              {gpus.filter(g => g.available).length} available
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-none border-2 border-[#00FF88]">
            <div className="text-xs text-gray-500 mb-1">Total Jobs</div>
            <div className="text-2xl font-bold text-[#00FF88]">
              {gpus.reduce((sum, gpu) => sum + gpu.totalJobs, 0)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {jobs.filter(j => j.status === JobStatus.Completed).length} completed
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-none border-2 border-[#00FF88]">
            <div className="text-xs text-gray-500 mb-1">Total Earned</div>
            <div className="text-2xl font-bold text-[#00FF88]">
              {jobs
                .filter(j => j.status === JobStatus.Completed)
                .reduce((sum, job) => sum + parseFloat(job.paymentAmount) * 0.95, 0)
                .toFixed(4)} ${getCurrencySymbol()}
            </div>
            <div className="text-xs text-gray-400 mt-1">95% of payments</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-none border-2 border-[#00FF88]">
            <div className="text-xs text-gray-500 mb-1">Active Jobs</div>
            <div className="text-2xl font-bold text-[#00FF88]">
              {jobs.filter(j => j.status === JobStatus.Claimed).length}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {availableJobs.length} pending claims
            </div>
          </div>
        </div>
      )}

      {/* Register GPU Form */}
      <div className="bg-gray-900 p-6 rounded-none">
        <h3 className="text-xl font-semibold mb-4 text-[#00FF88]">Register New GPU</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="GPU Model (e.g., RTX 4090)"
            value={gpuModel}
            onChange={(e) => setGpuModel(e.target.value)}
            className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white focus:border-[#00FF88] focus:outline-none"
          />
          <input
            type="number"
            placeholder="VRAM (GB)"
            value={vram}
            onChange={(e) => setVram(e.target.value)}
            className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white focus:border-[#00FF88] focus:outline-none"
          />
          <input
            type="text"
            placeholder={`Price per Hour (${getCurrencySymbol()})`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="bg-gray-800 border-2 border-gray-600 rounded-none px-4 py-2 text-white focus:border-[#00FF88] focus:outline-none"
          />
          <button
            onClick={registerGPU}
            disabled={txPending || !gpuModel || !vram || !price}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white px-6 py-2 rounded-none font-medium disabled:opacity-50 border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/30 transition-all hover:shadow-xl hover:shadow-[#00FF88]/50"
          >
            {txPending ? "Processing..." : "Register GPU"}
          </button>
        </div>
      </div>

      {/* My GPUs */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-[#00FF88]">My GPUs</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : gpus.length === 0 ? (
          <div className="text-gray-400">No GPUs registered yet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gpus.map((gpu) => {
              const activeJob = jobs.find(j => j.gpuId === gpu.id && j.status === JobStatus.Claimed);
              return (<div key={gpu.id} className="bg-gray-900 p-4 rounded-none border-2 border-transparent hover:border-[#00FF88] transition-all hover:shadow-lg hover:shadow-[#00FF88]/20">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-[#00FF88]">{gpu.model}</h4>
                  <div className="flex flex-col gap-1 items-end">
                    <span
                      className={`px-2 py-1 rounded-none text-xs border ${
                        gpu.available ? "bg-green-600 border-[#00FF88]" : "bg-gray-600 border-gray-500"
                      }`}
                    >
                      {gpu.available ? "Available" : "Unavailable"}
                    </span>
                    {activeJob && (
                      <span className="px-2 py-1 rounded-none text-xs bg-green-600 border border-[#00FF88] animate-pulse">
                        Working
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm space-y-1 text-gray-300">
                  <div>VRAM: {gpu.vramGB} GB</div>
                  <div>Price: {gpu.pricePerHour} ${getCurrencySymbol()}/hour</div>
                  <div>Total Jobs: {gpu.totalJobs}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Registered: {new Date(gpu.registeredAt * 1000).toLocaleDateString()}
                  </div>
                  {activeJob && (
                    <div className="mt-2 p-2 bg-green-900/30 rounded-none text-xs border-2 border-green-700">
                      Currently working on Job #{activeJob.jobId}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => toggleAvailability(gpu.id, gpu.available)}
                    disabled={txPending || activeJob !== undefined}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-none text-sm disabled:opacity-50 border border-gray-600 transition-all hover:border-[#00FF88]"
                    title={activeJob ? "Cannot change while job is active" : ""}
                  >
                    {gpu.available ? "Set Unavailable" : "Set Available"}
                  </button>
                  <button
                    onClick={() => {
                      if (activeJob) {
                        alert("Cannot remove GPU while job is active!");
                        return;
                      }
                      if (confirm(`Remove GPU #${gpu.id} (${gpu.model})? This will mark it as unavailable.`)) {
                        toggleAvailability(gpu.id, true);
                      }
                    }}
                    disabled={txPending || activeJob !== undefined}
                    className="bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-none text-sm disabled:opacity-50 border border-[#00FF88] transition-all hover:shadow-lg hover:shadow-[#00FF88]/50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Available Jobs to Claim */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-[#00FF88]">Available Jobs to Claim</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : availableJobs.length === 0 ? (
          <div className="text-gray-400">No pending jobs for your GPUs</div>
        ) : (
          <div className="space-y-4">
            {availableJobs.map((job) => {
              const gpu = gpus.find(g => g.id === job.gpuId);
              const yourEarnings = (parseFloat(job.paymentAmount) * 0.95).toFixed(4);
              const platformFee = (parseFloat(job.paymentAmount) * 0.05).toFixed(4);

              return (
              <div key={job.jobId} className="bg-gradient-to-r from-green-900/20 to-gray-900 p-6 rounded-none border-2 border-green-600">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-semibold text-[#00FF88]">Job #{job.jobId}</h4>
                      <span className="px-3 py-1 rounded-none text-sm font-medium bg-green-600 border border-[#00FF88] animate-pulse">
                        OPEN - Ready to Claim!
                      </span>
                    </div>
                    <p className="text-gray-300 text-lg mb-3">{job.description}</p>

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-3 gap-4 mt-3 p-3 bg-black rounded-none border border-[#00FF88]/30">
                      <div>
                        <div className="text-xs text-gray-500">Total Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">You'll Earn (95%)</div>
                        <div className="text-lg font-semibold text-[#00FF88]">{yourEarnings} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU</div>
                        <div className="text-sm text-[#00FF88]">{gpu?.model || `GPU #${job.gpuId}`}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm space-y-1 text-gray-400">
                      <div>Compute Hours: {job.computeHours}h</div>
                      <div>Consumer: {job.consumer.slice(0, 10)}...{job.consumer.slice(-8)}</div>
                      <div>Posted: {new Date(job.createdAt * 1000).toLocaleString()}</div>
                      <div className="text-xs text-[#00FF88] mt-2">Platform fee: {platformFee} ${getCurrencySymbol()} (5%)</div>
                    </div>
                  </div>

                  {/* Claim Button */}
                  <div className="ml-4">
                    <button
                      onClick={() => claimJob(job.jobId)}
                      disabled={txPending}
                      className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white px-8 py-4 rounded-none font-bold text-lg disabled:opacity-50 border-2 border-[#00FF88] shadow-xl shadow-[#00FF88]/50 animate-pulse transition-all hover:shadow-2xl hover:shadow-[#00FF88]/70"
                    >
                      Claim Job<br/>
                      <span className="text-sm font-normal">Earn {yourEarnings} ${getCurrencySymbol()}</span>
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current Jobs */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-[#00FF88]">Current Jobs</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : jobs.filter(j => j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled).length === 0 ? (
          <div className="text-gray-400">No active jobs</div>
        ) : (
          <div className="space-y-4">
            {jobs.filter(j => j.status !== JobStatus.Completed && j.status !== JobStatus.Cancelled).map((job) => {
              const now = Math.floor(Date.now() / 1000);
              const timeElapsed = job.claimedAt > 0 ? now - job.claimedAt : 0;
              const totalSeconds = job.computeHours * 3600;
              const remainingSeconds = Math.max(0, totalSeconds - timeElapsed);
              const hoursLeft = Math.floor(remainingSeconds / 3600);
              const minutesLeft = Math.floor((remainingSeconds % 3600) / 60);
              const progress = job.claimedAt > 0 ? Math.min(100, (timeElapsed / totalSeconds) * 100) : 0;
              const yourEarnings = (parseFloat(job.paymentAmount) * 0.95).toFixed(4);
              const platformFee = (parseFloat(job.paymentAmount) * 0.05).toFixed(4);
              const jobData = parseJobData(job.description);

              return (
              <div key={job.jobId} className="bg-gray-900 p-6 rounded-none border-2 border-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-semibold text-[#00FF88]">Job #{job.jobId}</h4>
                      <span className="px-3 py-1 rounded-none text-xs bg-gray-700 text-gray-300 border border-gray-600">
                        {jobData.type || "simple"}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-none text-sm font-medium border ${
                          job.status === JobStatus.Claimed
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

                    {/* Time Progress Bar - Only for Claimed jobs */}
                    {job.status === JobStatus.Claimed && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Work Progress</span>
                          <span className="text-[#00FF88] font-semibold">
                            {remainingSeconds > 0
                              ? `${hoursLeft}h ${minutesLeft}m remaining`
                              : "Time exceeded - Complete job now!"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-none h-3 border border-gray-700">
                          <div
                            className={`h-3 rounded-none transition-all ${
                              remainingSeconds > 0 ? "bg-gradient-to-r from-green-500 to-[#00FF88] shadow-lg shadow-[#00FF88]/50" : "bg-green-700 animate-pulse"
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-black rounded-none border border-[#00FF88]/30">
                      <div>
                        <div className="text-xs text-gray-500">Total Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Your Earnings (95%)</div>
                        <div className="text-lg font-semibold text-[#00FF88]">{yourEarnings} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Platform Fee (5%)</div>
                        <div className="text-sm text-gray-400">{platformFee} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU Used</div>
                        <div className="text-sm text-[#00FF88]">GPU #{job.gpuId}</div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="mt-3 text-sm space-y-1 text-gray-400">
                      <div>Consumer: {job.consumer.slice(0, 10)}...{job.consumer.slice(-8)}</div>
                      <div>Compute Hours: {job.computeHours}h</div>
                      {job.claimedAt > 0 && (
                        <div>Claimed: {new Date(job.claimedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.completedAt > 0 && (
                        <div>Completed: {new Date(job.completedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.resultHash && (
                        <div className="text-[#00FF88]">Result: {job.resultHash}</div>
                      )}
                    </div>

                    {/* Execution Logs */}
                    {executionLogs[job.jobId] && (
                      <div className="mt-4 p-4 bg-black rounded-none border-2 border-[#00FF88]">
                        <div className="text-sm text-gray-400 mb-2">GPU Worker Execution Logs:</div>
                        <pre className="text-xs text-[#00FF88] font-mono overflow-x-auto max-h-64 whitespace-pre-wrap">
                          {executionLogs[job.jobId]}
                        </pre>
                      </div>
                    )}

                    {/* Auto-generated Result */}
                    {executionResults[job.jobId] && !ipfsHashes[job.jobId] && (
                      <div className="mt-3 p-3 bg-green-900/20 rounded-none border-2 border-[#00FF88]">
                        <div className="text-xs text-gray-500 mb-1">Auto-Generated Result Hash:</div>
                        <div className="text-sm text-[#00FF88] font-mono break-all">
                          {executionResults[job.jobId]}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Upload to IPFS for permanent storage or submit directly
                        </div>
                      </div>
                    )}

                    {/* IPFS Upload Result */}
                    {ipfsHashes[job.jobId] && (
                      <div className="mt-3 p-3 bg-green-900/30 rounded-none border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/20">
                        <div className="text-xs text-gray-500 mb-1">IPFS Result Hash (Permanent Storage):</div>
                        <div className="text-sm text-[#00FF88] font-mono break-all">
                          {ipfsHashes[job.jobId]}
                        </div>
                        <a
                          href={getIPFSGatewayUrl(ipfsHashes[job.jobId].replace('ipfs://', ''))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 inline-block"
                        >
                          View on IPFS Gateway
                        </a>
                        <div className="text-xs text-gray-500 mt-1">
                          Ready to submit to blockchain
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4 flex flex-col gap-2">
                    {job.status === JobStatus.Claimed && (
                      <>
                        {/* Run with GPU button */}
                        {(jobData.type === "python-script" || jobData.type === "docker-image") && (
                          <button
                            onClick={() => runJobWithGPU(job)}
                            disabled={processingJobId === job.jobId || txPending}
                            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white px-6 py-3 rounded-none font-medium disabled:opacity-50 border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/30 transition-all hover:shadow-xl hover:shadow-[#00FF88]/50 whitespace-nowrap"
                          >
                            {processingJobId === job.jobId ? "Processing..." : "Run with GPU"}<br/>
                            <span className="text-xs">Automatic execution</span>
                          </button>
                        )}

                        {/* Upload to IPFS button */}
                        {executionResults[job.jobId] && !ipfsHashes[job.jobId] && (
                          <button
                            onClick={() => uploadResultToIPFS(job.jobId)}
                            disabled={uploadingToIPFS[job.jobId] || txPending}
                            className="bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-none font-medium disabled:opacity-50 border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/30 transition-all hover:shadow-xl hover:shadow-[#00FF88]/50 whitespace-nowrap"
                          >
                            {uploadingToIPFS[job.jobId] ? "Uploading..." : "Upload to IPFS"}<br/>
                            <span className="text-xs">Permanent storage</span>
                          </button>
                        )}

                        {/* Complete Job button */}
                        <button
                          onClick={() => completeJob(job.jobId)}
                          disabled={txPending}
                          className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white px-6 py-3 rounded-none font-medium disabled:opacity-50 border-2 border-[#00FF88] shadow-lg shadow-[#00FF88]/30 transition-all hover:shadow-xl hover:shadow-[#00FF88]/50 whitespace-nowrap"
                        >
                          {ipfsHashes[job.jobId] ? "Submit to Blockchain" : executionResults[job.jobId] ? "Submit Result" : "Complete Job"}<br/>
                          <span className="text-xs">Earn {yourEarnings} ${getCurrencySymbol()}</span>
                        </button>
                      </>
                    )}
                    {job.status === JobStatus.Completed && (
                      <div className="text-center p-3 bg-green-900/30 rounded-none border-2 border-[#00FF88]">
                        <div className="text-[#00FF88] font-semibold">Paid!</div>
                        <div className="text-sm text-gray-400">{yourEarnings} ${getCurrencySymbol()}</div>
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
        ) : jobs.filter(j => j.status === JobStatus.Completed).length === 0 ? (
          <div className="text-gray-400">No completed jobs yet</div>
        ) : (
          <div className="space-y-4">
            {jobs.filter(j => j.status === JobStatus.Completed).map((job) => {
              const yourEarnings = (parseFloat(job.paymentAmount) * 0.95).toFixed(4);
              const platformFee = (parseFloat(job.paymentAmount) * 0.05).toFixed(4);
              const jobData = parseJobData(job.description);

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
                        <div className="text-xs text-gray-500">Total Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">You Earned (95%)</div>
                        <div className="text-lg font-semibold text-[#00FF88]">{yourEarnings} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Platform Fee (5%)</div>
                        <div className="text-sm text-gray-500">{platformFee} ${getCurrencySymbol()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU Used</div>
                        <div className="text-sm text-gray-400">GPU #{job.gpuId}</div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="mt-3 text-sm space-y-1 text-gray-500">
                      <div>Consumer: {job.consumer.slice(0, 10)}...{job.consumer.slice(-8)}</div>
                      <div>Compute Hours: {job.computeHours}h</div>
                      {job.claimedAt > 0 && (
                        <div>Claimed: {new Date(job.claimedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.completedAt > 0 && (
                        <div>Completed: {new Date(job.completedAt * 1000).toLocaleString()}</div>
                      )}
                      {job.resultHash && (
                        <div className="text-[#00FF88] mt-2 p-2 bg-green-900/20 rounded-none border border-[#00FF88]">
                          Result: <span className="font-mono text-xs">{job.resultHash}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="ml-4">
                    <div className="text-center p-3 bg-green-900/30 rounded-none border-2 border-[#00FF88]">
                      <div className="text-[#00FF88] font-semibold">Paid!</div>
                      <div className="text-sm text-gray-400">{yourEarnings} ${getCurrencySymbol()}</div>
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
