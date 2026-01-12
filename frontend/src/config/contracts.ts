// Network configurations
export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    name: 'Sepolia',
    rpcUrl: 'https://sepolia.infura.io/v3/fa01d2a125bb46a08b154ce956b7070b',
    blockExplorer: 'https://sepolia.etherscan.io',
    gpuRegistry: "0x25701aCCf2B9774afE71f43f4e010Eb82a0A7444",
    jobMarketplace: "0x9C1c395C0B1B15eF4DE0B618597b1e221b7E2128",
  },
  shardeum: {
    chainId: 8119,
    chainIdHex: '0x1fb7',
    name: 'Shardeum Sphinx 1.X',
    rpcUrl: 'https://api-mezame.shardeum.org',
    blockExplorer: 'https://explorer-mezame.shardeum.org',
    gpuRegistry: "0x0dBF59AeCD34c52516DDF4143fc827341E066074",
    jobMarketplace: "0x2691368CcfF8AE2048DC17171fC98853f9De1Ff5",
  },
};

export const SUPPORTED_CHAIN_IDS = [11155111, 8119];

// Helper to get contract addresses for current network
export function getContracts(chainId: number) {
  if (chainId === 11155111) return NETWORKS.sepolia;
  if (chainId === 8119) return NETWORKS.shardeum;
  return NETWORKS.sepolia; // Default to Sepolia
}

export function getNetworkName(chainId: number): string {
  if (chainId === 11155111) return 'Sepolia';
  if (chainId === 8119) return 'Shardeum';
  return 'Unknown Network';
}

// Legacy exports for backwards compatibility
export const SEPOLIA_CHAIN_ID = 11155111;
export const CONTRACTS = NETWORKS;

export const GPU_REGISTRY_ABI = [{"type":"function","name":"getAllGPUs","inputs":[],"outputs":[{"name":"","type":"uint256[]","internalType":"uint256[]"}],"stateMutability":"view"},{"type":"function","name":"getAvailableGPUs","inputs":[],"outputs":[{"name":"","type":"uint256[]","internalType":"uint256[]"}],"stateMutability":"view"},{"type":"function","name":"getGPU","inputs":[{"name":"gpuId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"tuple","internalType":"struct GPURegistry.GPU","components":[{"name":"provider","type":"address","internalType":"address"},{"name":"model","type":"string","internalType":"string"},{"name":"vramGB","type":"uint256","internalType":"uint256"},{"name":"pricePerHour","type":"uint256","internalType":"uint256"},{"name":"available","type":"bool","internalType":"bool"},{"name":"totalJobs","type":"uint256","internalType":"uint256"},{"name":"registeredAt","type":"uint256","internalType":"uint256"}]}],"stateMutability":"view"},{"type":"function","name":"getProviderGPUs","inputs":[{"name":"provider","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256[]","internalType":"uint256[]"}],"stateMutability":"view"},{"type":"function","name":"nextGPUId","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"registerGPU","inputs":[{"name":"model","type":"string","internalType":"string"},{"name":"vramGB","type":"uint256","internalType":"uint256"},{"name":"pricePerHour","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},{"type":"function","name":"setAvailability","inputs":[{"name":"gpuId","type":"uint256","internalType":"uint256"},{"name":"available","type":"bool","internalType":"bool"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"updatePrice","inputs":[{"name":"gpuId","type":"uint256","internalType":"uint256"},{"name":"newPrice","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"GPUAvailabilityUpdated","inputs":[{"name":"gpuId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"available","type":"bool","indexed":false,"internalType":"bool"}],"anonymous":false},{"type":"event","name":"GPUPriceUpdated","inputs":[{"name":"gpuId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"newPrice","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"GPURegistered","inputs":[{"name":"gpuId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"},{"name":"model","type":"string","indexed":false,"internalType":"string"},{"name":"pricePerHour","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false}] as const;

export const JOB_MARKETPLACE_ABI = [{"type":"constructor","inputs":[{"name":"_gpuRegistryAddress","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},{"type":"receive","stateMutability":"payable"},{"type":"function","name":"PLATFORM_FEE_PERCENT","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"cancelJob","inputs":[{"name":"jobId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"claimJob","inputs":[{"name":"jobId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"completeJob","inputs":[{"name":"jobId","type":"uint256","internalType":"uint256"},{"name":"resultHash","type":"string","internalType":"string"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"getConsumerJobs","inputs":[{"name":"consumer","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256[]","internalType":"uint256[]"}],"stateMutability":"view"},{"type":"function","name":"getJob","inputs":[{"name":"jobId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"tuple","internalType":"struct JobMarketplace.Job","components":[{"name":"jobId","type":"uint256","internalType":"uint256"},{"name":"consumer","type":"address","internalType":"address"},{"name":"gpuId","type":"uint256","internalType":"uint256"},{"name":"description","type":"string","internalType":"string"},{"name":"computeHours","type":"uint256","internalType":"uint256"},{"name":"paymentAmount","type":"uint256","internalType":"uint256"},{"name":"provider","type":"address","internalType":"address"},{"name":"status","type":"uint8","internalType":"enum JobMarketplace.JobStatus"},{"name":"createdAt","type":"uint256","internalType":"uint256"},{"name":"claimedAt","type":"uint256","internalType":"uint256"},{"name":"completedAt","type":"uint256","internalType":"uint256"},{"name":"resultHash","type":"string","internalType":"string"}]}],"stateMutability":"view"},{"type":"function","name":"getOpenJobs","inputs":[],"outputs":[{"name":"","type":"uint256[]","internalType":"uint256[]"}],"stateMutability":"view"},{"type":"function","name":"getProviderJobs","inputs":[{"name":"provider","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256[]","internalType":"uint256[]"}],"stateMutability":"view"},{"type":"function","name":"nextJobId","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"postJob","inputs":[{"name":"gpuId","type":"uint256","internalType":"uint256"},{"name":"description","type":"string","internalType":"string"},{"name":"computeHours","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"payable"},{"type":"event","name":"JobCancelled","inputs":[{"name":"jobId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"JobClaimed","inputs":[{"name":"jobId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},{"type":"event","name":"JobCompleted","inputs":[{"name":"jobId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"resultHash","type":"string","indexed":false,"internalType":"string"}],"anonymous":false},{"type":"event","name":"JobPosted","inputs":[{"name":"jobId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"consumer","type":"address","indexed":true,"internalType":"address"},{"name":"gpuId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"paymentAmount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"PaymentReleased","inputs":[{"name":"jobId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"provider","type":"address","indexed":true,"internalType":"address"},{"name":"amount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false}] as const;
