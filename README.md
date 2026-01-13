# 🥦 BroccoByte - Decentralized GPU Marketplace

A **DePIN (Decentralized Physical Infrastructure Network)** platform that democratizes GPU access through blockchain technology. Built on Ethereum, BroccoByte enables anyone to monetize their idle GPU resources or access affordable compute power for AI/ML workloads without intermediaries.

## 🌟 Key Features

- **🎨 Beautiful Landing Page** - Designed with ThinkRoot AI for an intuitive, modern user experience
- **💰 Multi-Network Support** - Deployed on both **Sepolia** and **Shardeum** testnets for maximum accessibility
- **🔒 Smart Contract Escrow** - Trustless payments with automatic release on job completion
- **⚡ Real-time Updates** - Event-based notifications for instant job status tracking
- **📦 IPFS Integration** - Decentralized storage for job results via Pinata
- **💱 Dynamic Pricing** - Automatic currency conversion (ETH/SHM) based on active network
- **🎯 Dual Dashboard** - Separate interfaces for GPU providers and compute consumers

## 🚀 Live Demo

**Frontend**: [Deployed on Vercel](https://your-vercel-url.vercel.app)

**Smart Contracts**:

### Sepolia Testnet
- **Network**: Ethereum Sepolia
- **Currency**: ETH
- **GPURegistry**: [`0x25701aCCf2B9774afE71f43f4e010Eb82a0A7444`](https://sepolia.etherscan.io/address/0x25701aCCf2B9774afE71f43f4e010Eb82a0A7444)
- **JobMarketplace**: [`0x9C1c395C0B1B15eF4DE0B618597b1e221b7E2128`](https://sepolia.etherscan.io/address/0x9C1c395C0B1B15eF4DE0B618597b1e221b7E2128)

### Shardeum Sphinx 1.X Testnet
- **Network**: Shardeum Layer 1
- **Currency**: SHM
- **GPURegistry**: [`0x0dBF59AeCD34c52516DDF4143fc827341E066074`](https://explorer-mezame.shardeum.org/address/0x0dBF59AeCD34c52516DDF4143fc827341E066074)
- **JobMarketplace**: [`0x2691368CcfF8AE2048DC17171fC98853f9De1Ff5`](https://explorer-mezame.shardeum.org/address/0x2691368CcfF8AE2048DC17171fC98853f9De1Ff5)

## 🎯 Why Shardeum?

We chose **Shardeum** as our secondary deployment network because:

1. **⚡ Low Gas Fees** - Shardeum's dynamic state sharding keeps transaction costs minimal, making GPU rentals economically viable for smaller tasks
2. **🌍 Linear Scalability** - As demand grows, Shardeum's architecture scales horizontally without congestion
3. **🔓 EVM Compatibility** - Same Solidity contracts deploy seamlessly without modification
4. **🚀 Fast Finality** - Quick transaction confirmation enables real-time job processing
5. **🌐 True Decentralization** - Auto-scaling sharding maintains decentralization at scale

**Multi-chain strategy**: Users can choose Sepolia for Ethereum ecosystem familiarity or Shardeum for cost-effectiveness and speed.

## 🛠️ Tech Stack

**Blockchain & Smart Contracts**
- Solidity ^0.8.20
- Foundry (Forge, Cast)
- OpenZeppelin Contracts
- ethers.js v5.7.2

**Frontend**
- React 18 + TypeScript
- Vite 7.3.1 (Lightning-fast builds)
- TailwindCSS 3 (Utility-first styling)
- ThinkRoot AI (Landing page design)

**Infrastructure**
- IPFS via Pinata (Decentralized storage)
- Vercel (Auto-deployment)
- MetaMask (Web3 wallet)

**Supported Networks**
- Ethereum Sepolia Testnet (Chain ID: 11155111)
- Shardeum Sphinx 1.X (Chain ID: 8119)

## 📁 Project Structure

```
ethereum-gpu-depin/
├── contracts/                  # Foundry smart contract project
│   ├── src/
│   │   ├── GPURegistry.sol    # GPU resource registry
│   │   └── JobMarketplace.sol # Job posting & escrow
│   ├── test/                  # Smart contract tests
│   ├── script/
│   │   └── Deploy.s.sol       # Multi-network deployment
│   └── foundry.toml
│
├── frontend/                   # React application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ProviderDashboard.tsx  # GPU provider interface
│   │   │   └── ConsumerDashboard.tsx  # Compute consumer interface
│   │   ├── hooks/
│   │   │   └── useWallet.ts           # Web3 wallet management
│   │   ├── config/
│   │   │   └── contracts.ts           # Multi-network config
│   │   └── utils/
│   │       └── ipfs.ts                # IPFS upload utilities
│   └── package.json
│
├── provider-worker/            # GPU job execution worker
│   └── server.js              # Express server for job processing
│
├── consumer-examples/          # Example job scripts
└── README.md
```

## 🏃 Quick Start

### Prerequisites

```bash
# Required software
Node.js >= 18.0.0
npm >= 9.0.0
Foundry (forge, cast)
MetaMask browser extension
```

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/yourusername/broccobyte.git
cd broccobyte

# Install frontend dependencies
cd frontend
npm install

# Install provider worker dependencies
cd ../provider-worker
npm install
```

### 2. Environment Setup

Create `frontend/.env`:
```env
VITE_PINATA_JWT=your_pinata_jwt_token_here
```

Create `contracts/.env`:
```env
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SHARDEUM_RPC_URL=https://api-mezame.shardeum.org
```

### 3. Run Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

### 4. Run Provider Worker (Optional)

```bash
cd provider-worker
npm start
# GPU worker runs on http://localhost:3001
```

## 💡 How It Works

### For GPU Providers

1. **Connect Wallet** - Link MetaMask to the platform
2. **Register GPU** - Add your GPU specs (Model: RTX 4090, VRAM: 24GB, Price: 0.01 ETH/hour)
3. **Go Online** - Set availability to accept jobs
4. **Claim Jobs** - Browse and claim matching compute requests
5. **Execute & Earn** - Complete jobs, upload results to IPFS, receive 95% of payment

### For Compute Consumers

1. **Connect Wallet** - Link MetaMask
2. **Browse GPUs** - Filter by VRAM, price, and provider reputation
3. **Post Job** - Describe task, select hours, payment locks in escrow
4. **Monitor Progress** - Real-time status updates via blockchain events
5. **Receive Results** - Download from IPFS when provider completes work

### Payment Flow

```
Consumer Posts Job
    ↓
Payment Locked in Smart Contract (Escrow)
    ↓
Provider Claims Job
    ↓
Provider Completes Work + Uploads to IPFS
    ↓
Smart Contract Auto-Releases Payment:
    • 95% → Provider
    • 5% → Platform Fee
```

## 🔗 Get Testnet Tokens

**Sepolia Testnet (ETH)**
- [Alchemy Faucet](https://sepoliafaucet.com/)
- [Infura Faucet](https://www.infura.io/faucet/sepolia)

**Shardeum Testnet (SHM)**
- [Official Shardeum Faucet](https://faucet-sphinx.shardeum.org/)
- Enter wallet address, receive 100 SHM instantly

## 🎨 UI/UX Features

- **🌙 Dark Theme** - Broccoli green accents on black background
- **🔄 Network Switcher** - Seamless toggle between Sepolia ↔ Shardeum
- **🔔 Live Notifications** - Toast alerts for job claims, completions, payments
- **💰 Smart Currency Display** - Shows ETH on Sepolia, SHM on Shardeum
- **📱 Responsive Design** - Works on desktop, tablet, and mobile
- **⚡ Fast Loading** - Optimized with Vite's HMR and code splitting

## 📜 Smart Contract Architecture

### GPURegistry.sol

**Purpose**: On-chain GPU resource catalog

```solidity
struct GPU {
    address provider;
    string model;          // "NVIDIA RTX 4090"
    uint256 vramGB;        // 24
    uint256 pricePerHour;  // in wei
    bool available;
    uint256 totalJobs;
    uint256 registeredAt;
}
```

**Key Functions**:
- `registerGPU(model, vram, price)` → Returns GPU ID
- `setAvailability(gpuId, bool)` → Toggle on/off
- `updatePrice(gpuId, newPrice)` → Adjust pricing
- `getAvailableGPUs()` → Query all online GPUs

**Access Control**: Only GPU owner can modify their listings

---

### JobMarketplace.sol

**Purpose**: Job posting, escrow, and payment automation

```solidity
enum JobStatus { Open, Claimed, Completed, Cancelled }

struct Job {
    uint256 jobId;
    address consumer;
    uint256 gpuId;
    string description;
    uint256 computeHours;
    uint256 paymentAmount;      // Locked in contract
    address provider;
    JobStatus status;
    uint256 createdAt;
    uint256 claimedAt;
    uint256 completedAt;
    string resultHash;          // IPFS CID
}
```

**Key Functions**:
- `postJob(gpuId, description, hours) payable` → Locks ETH/SHM
- `claimJob(jobId)` → Provider accepts work
- `completeJob(jobId, ipfsHash)` → Submit results
- `cancelJob(jobId)` → Refund if unclaimed

**Payment Logic**:
```solidity
uint256 providerAmount = (payment * 95) / 100;
uint256 platformFee = payment - providerAmount;
payable(provider).transfer(providerAmount);
```

**Cross-Contract Verification**:
```solidity
IGPURegistry(registry).getGPU(gpuId);
require(gpu.available, "GPU offline");
```

## 🔐 Security Features

✅ **No Private Keys in Code** - All secrets in `.env` files (gitignored)
✅ **Smart Contract Access Control** - Only owners can modify resources
✅ **Escrow Protection** - Payments locked until work completion
✅ **Input Validation** - Requires non-empty descriptions, positive values
✅ **Reentrancy Guards** - Safe external calls with checks-effects-interactions
✅ **Event Logging** - All state changes emit events for transparency

## 🚀 Deployment Guide

### Deploy Smart Contracts

```bash
cd contracts

# Compile contracts
forge build

# Run tests
forge test -vv

# Deploy to Sepolia
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Deploy to Shardeum
forge script script/Deploy.s.sol \
  --rpc-url $SHARDEUM_RPC_URL \
  --broadcast \
  --legacy
```

### Deploy Frontend to Vercel

```bash
cd frontend
npm run build

# Push to GitHub (Vercel auto-deploys)
git push origin main
```

## 📊 Gas Costs Comparison

| Operation | Sepolia (ETH) | Shardeum (SHM) | Savings |
|-----------|---------------|----------------|---------|
| Register GPU | ~150,000 gas | ~150,000 gas | - |
| Post Job | ~120,000 gas | ~120,000 gas | - |
| Complete Job | ~80,000 gas | ~80,000 gas | - |
| **At $2000 ETH** | $0.60 | $0.00024 | **99.96%** |

*Shardeum's low gas prices make micropayments viable*

## 🌐 Multi-Chain Benefits

**Why Two Networks?**

| Feature | Sepolia | Shardeum |
|---------|---------|----------|
| Ecosystem | Established Ethereum | Emerging Layer 1 |
| Liquidity | High | Growing |
| Gas Fees | Moderate | Ultra-low |
| Speed | 12s blocks | ~2s finality |
| Best For | Large jobs | Micro-tasks |

Users choose based on their needs - Ethereum for trust, Shardeum for efficiency.

## 🧪 Testing

```bash
# Smart contract tests
cd contracts
forge test -vv

# Frontend type checking
cd frontend
npm run build

# Run provider worker
cd provider-worker
npm test
```

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- **ThinkRoot AI** - For crafting our beautiful, intuitive landing page design
- **Shardeum** - For providing a scalable, low-cost EVM-compatible blockchain
- **OpenZeppelin** - For battle-tested smart contract libraries
- **Pinata** - For reliable IPFS pinning and gateway services
- **Vercel** - For seamless frontend deployment and hosting

## 🔮 Roadmap

- [ ] Reputation system with NFT badges
- [ ] GPU performance benchmarking
- [ ] Multi-sig wallets for large jobs
- [ ] Cross-chain bridge (Sepolia ↔ Shardeum)
- [ ] Mobile app (React Native)
- [ ] GPU pooling for distributed computing

## 📞 Contact & Links

- **Website**: [broccobyte.vercel.app](https://broccobyte.vercel.app)
- **GitHub**: [github.com/yourusername/broccobyte](https://github.com/yourusername/broccobyte)
- **Twitter**: [@BroccoByte](https://twitter.com/broccobyte)
- **Discord**: [Join our community](https://discord.gg/broccobyte)

---

**Built with 🥦 by the BroccoByte team**
*Democratizing GPU access through blockchain technology*
