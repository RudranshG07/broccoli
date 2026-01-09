import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACTS, GPU_REGISTRY_ABI, JOB_MARKETPLACE_ABI } from "../config/contracts";
import type { GPU, Job } from "../types";
import { JobStatus, getJobStatusName } from "../types";

interface Props {
  address: string;
}

export default function ProviderDashboard({ address }: Props) {
  const [gpus, setGpus] = useState<(GPU & { id: number })[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Form state
  const [gpuModel, setGpuModel] = useState("");
  const [vram, setVram] = useState("");
  const [price, setPrice] = useState("");

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
      setGpus(gpuData);

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
    if (CONTRACTS.sepolia.gpuRegistry !== "0x0000000000000000000000000000000000000000") {
      loadData();

      // Setup event listeners for real-time updates
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const marketplaceContract = new ethers.Contract(
        CONTRACTS.sepolia.jobMarketplace,
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
        addNotification(`Payment received: ${ethAmount} ETH for Job #${jobId.toNumber()}`);
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
  }, [address]);

  const registerGPU = async () => {
    if (!gpuModel || !vram || !price) return;

    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACTS.sepolia.gpuRegistry,
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
        CONTRACTS.sepolia.gpuRegistry,
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
        CONTRACTS.sepolia.jobMarketplace,
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

  const completeJob = async (jobId: number) => {
    const resultHash = prompt(
      "Enter result hash (proof of completed work):\n\n" +
      "Examples:\n" +
      "• IPFS: ipfs://QmXxXxXxX...\n" +
      "• URL: https://storage.com/results.zip\n" +
      "• Hash: 0x1234abcd...\n" +
      "• Demo: completed-job-" + jobId + "\n\n" +
      "For testing, you can enter any text:"
    );
    if (!resultHash) return;

    setTxPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACTS.sepolia.jobMarketplace,
        JOB_MARKETPLACE_ABI,
        signer
      );

      const tx = await contract.completeJob(jobId, resultHash);
      await tx.wait();
      await loadData();
    } catch (error: any) {
      console.error("Failed to complete job:", error);
      alert(`Failed to complete job: ${error.message}`);
    } finally {
      setTxPending(false);
    }
  };

  if (CONTRACTS.sepolia.gpuRegistry === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-200 p-4 rounded">
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
              className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg border border-green-500 animate-pulse"
            >
              {notif}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-3xl font-bold text-green-400">Provider Dashboard</h2>

      {/* Statistics Overview */}
      {!loading && gpus.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 p-4 rounded-lg border border-green-500">
            <div className="text-xs text-gray-500 mb-1">Total GPUs</div>
            <div className="text-2xl font-bold text-green-400">{gpus.length}</div>
            <div className="text-xs text-gray-400 mt-1">
              {gpus.filter(g => g.available).length} available
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-green-500">
            <div className="text-xs text-gray-500 mb-1">Total Jobs</div>
            <div className="text-2xl font-bold text-green-400">
              {gpus.reduce((sum, gpu) => sum + gpu.totalJobs, 0)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {jobs.filter(j => j.status === JobStatus.Completed).length} completed
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-green-500">
            <div className="text-xs text-gray-500 mb-1">Total Earned</div>
            <div className="text-2xl font-bold text-green-400">
              {jobs
                .filter(j => j.status === JobStatus.Completed)
                .reduce((sum, job) => sum + parseFloat(job.paymentAmount) * 0.95, 0)
                .toFixed(4)} ETH
            </div>
            <div className="text-xs text-gray-400 mt-1">95% of payments</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-green-500">
            <div className="text-xs text-gray-500 mb-1">Active Jobs</div>
            <div className="text-2xl font-bold text-green-400">
              {jobs.filter(j => j.status === JobStatus.Claimed).length}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {availableJobs.length} pending claims
            </div>
          </div>
        </div>
      )}

      {/* Register GPU Form */}
      <div className="bg-gray-900 p-6 rounded-lg">
        <h3 className="text-xl font-semibold mb-4 text-green-400">Register New GPU</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="GPU Model (e.g., RTX 4090)"
            value={gpuModel}
            onChange={(e) => setGpuModel(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
          />
          <input
            type="number"
            placeholder="VRAM (GB)"
            value={vram}
            onChange={(e) => setVram(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
          />
          <input
            type="text"
            placeholder="Price per Hour (ETH)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white"
          />
          <button
            onClick={registerGPU}
            disabled={txPending || !gpuModel || !vram || !price}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50"
          >
            {txPending ? "Processing..." : "Register GPU"}
          </button>
        </div>
      </div>

      {/* My GPUs */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-green-400">My GPUs</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : gpus.length === 0 ? (
          <div className="text-gray-400">No GPUs registered yet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gpus.map((gpu) => {
              const activeJob = jobs.find(j => j.gpuId === gpu.id && j.status === JobStatus.Claimed);
              return (<div key={gpu.id} className="bg-gray-900 p-4 rounded-lg border-2 border-transparent hover:border-green-500">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-green-400">{gpu.model}</h4>
                  <div className="flex flex-col gap-1 items-end">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        gpu.available ? "bg-green-600" : "bg-gray-600"
                      }`}
                    >
                      {gpu.available ? "Available" : "Unavailable"}
                    </span>
                    {activeJob && (
                      <span className="px-2 py-1 rounded text-xs bg-green-600 animate-pulse">
                        Working
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm space-y-1 text-gray-300">
                  <div>VRAM: {gpu.vramGB} GB</div>
                  <div>Price: {gpu.pricePerHour} ETH/hour</div>
                  <div>Total Jobs: {gpu.totalJobs}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Registered: {new Date(gpu.registeredAt * 1000).toLocaleDateString()}
                  </div>
                  {activeJob && (
                    <div className="mt-2 p-2 bg-green-900/30 rounded text-xs border border-green-700">
                      Currently working on Job #{activeJob.jobId}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => toggleAvailability(gpu.id, gpu.available)}
                    disabled={txPending || activeJob !== undefined}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
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
                    className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
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
        <h3 className="text-2xl font-semibold mb-4 text-green-400">Available Jobs to Claim</h3>
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
              <div key={job.jobId} className="bg-gradient-to-r from-green-900/20 to-gray-900 p-6 rounded-lg border-2 border-green-600">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-semibold text-green-400">Job #{job.jobId}</h4>
                      <span className="px-3 py-1 rounded text-sm font-medium bg-green-600 animate-pulse">
                        OPEN - Ready to Claim!
                      </span>
                    </div>
                    <p className="text-gray-300 text-lg mb-3">{job.description}</p>

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-3 gap-4 mt-3 p-3 bg-black rounded">
                      <div>
                        <div className="text-xs text-gray-500">Total Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">You'll Earn (95%)</div>
                        <div className="text-lg font-semibold text-green-400">{yourEarnings} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU</div>
                        <div className="text-sm text-green-400">{gpu?.model || `GPU #${job.gpuId}`}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm space-y-1 text-gray-400">
                      <div>Compute Hours: {job.computeHours}h</div>
                      <div>Consumer: {job.consumer.slice(0, 10)}...{job.consumer.slice(-8)}</div>
                      <div>Posted: {new Date(job.createdAt * 1000).toLocaleString()}</div>
                      <div className="text-xs text-green-400 mt-2">Platform fee: {platformFee} ETH (5%)</div>
                    </div>
                  </div>

                  {/* Claim Button */}
                  <div className="ml-4">
                    <button
                      onClick={() => claimJob(job.jobId)}
                      disabled={txPending}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-bold text-lg disabled:opacity-50 shadow-lg animate-pulse"
                    >
                      Claim Job<br/>
                      <span className="text-sm font-normal">Earn {yourEarnings} ETH</span>
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Jobs */}
      <div>
        <h3 className="text-2xl font-semibold mb-4 text-green-500">My Active Jobs</h3>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="text-gray-400">No jobs claimed yet</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const now = Math.floor(Date.now() / 1000);
              const timeElapsed = job.claimedAt > 0 ? now - job.claimedAt : 0;
              const totalSeconds = job.computeHours * 3600;
              const remainingSeconds = Math.max(0, totalSeconds - timeElapsed);
              const hoursLeft = Math.floor(remainingSeconds / 3600);
              const minutesLeft = Math.floor((remainingSeconds % 3600) / 60);
              const progress = job.claimedAt > 0 ? Math.min(100, (timeElapsed / totalSeconds) * 100) : 0;
              const yourEarnings = (parseFloat(job.paymentAmount) * 0.95).toFixed(4);
              const platformFee = (parseFloat(job.paymentAmount) * 0.05).toFixed(4);

              return (
              <div key={job.jobId} className="bg-gray-900 p-6 rounded-lg border-2 border-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-xl font-semibold text-green-400">Job #{job.jobId}</h4>
                      <span
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          job.status === JobStatus.Claimed
                            ? "bg-green-600 animate-pulse"
                            : job.status === JobStatus.Completed
                            ? "bg-green-600"
                            : "bg-gray-600"
                        }`}
                      >
                        {getJobStatusName(job.status)}
                      </span>
                    </div>
                    <p className="text-gray-300 text-lg mb-3">{job.description}</p>

                    {/* Time Progress Bar - Only for Claimed jobs */}
                    {job.status === JobStatus.Claimed && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Work Progress</span>
                          <span className="text-green-400 font-semibold">
                            {remainingSeconds > 0
                              ? `${hoursLeft}h ${minutesLeft}m remaining`
                              : "Time exceeded - Complete job now!"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              remainingSeconds > 0 ? "bg-green-500" : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-black rounded">
                      <div>
                        <div className="text-xs text-gray-500">Total Payment</div>
                        <div className="text-lg font-semibold text-white">{job.paymentAmount} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Your Earnings (95%)</div>
                        <div className="text-lg font-semibold text-green-400">{yourEarnings} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Platform Fee (5%)</div>
                        <div className="text-sm text-gray-400">{platformFee} ETH</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPU Used</div>
                        <div className="text-sm text-green-400">GPU #{job.gpuId}</div>
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
                        <div className="text-green-400">Result: {job.resultHash}</div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="ml-4">
                    {job.status === JobStatus.Claimed && (
                      <button
                        onClick={() => completeJob(job.jobId)}
                        disabled={txPending}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 shadow-lg"
                      >
                        Complete Job<br/>
                        <span className="text-xs">Submit result & earn {yourEarnings} ETH</span>
                      </button>
                    )}
                    {job.status === JobStatus.Completed && (
                      <div className="text-center p-3 bg-green-900/30 rounded-lg border border-green-600">
                        <div className="text-green-400 font-semibold">Paid!</div>
                        <div className="text-sm text-gray-400">{yourEarnings} ETH</div>
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
    </div>
  );
}
