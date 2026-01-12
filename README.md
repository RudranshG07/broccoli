# 🥦 BroccoByte - Decentralized GPU Marketplace

A DePIN (Decentralized Physical Infrastructure Network) platform built on Ethereum that enables GPU sharing and rental. Providers can rent out their GPU compute power, and consumers can post computational jobs with automatic escrow payments.

## 🌟 Features

- **GPU Provider Dashboard**: Register GPUs, manage availability, claim and complete jobs
- **Consumer Dashboard**: Browse available GPUs, post jobs, track completion
- **Multi-Network Support**: Deployed on Sepolia and Shardeum testnets
- **Smart Contract Escrow**: Secure payments with automatic release on job completion
- **Real-time Updates**: Event-based notifications for job status changes
- **IPFS Integration**: Decentralized storage for job results
- **Dynamic Pricing**: Show correct currency (ETH/SHM) based on network

## 🚀 Live Demo

**Frontend**: Deployed on Vercel
**Contracts**:
- Sepolia Testnet
  - GPURegistry: `0x25701aCCf2B9774afE71f43f4e010Eb82a0A7444`
  - JobMarketplace: `0x9C1c395C0B1B15eF4DE0B618597b1e221b7E2128`
- Shardeum Testnet
  - GPURegistry: `0x0dBF59AeCD34c52516DDF4143fc827341E066074`
  - JobMarketplace: `0x2691368CcfF8AE2048DC17171fC98853f9De1Ff5`

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity + Foundry
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Blockchain**: Ethereum (Sepolia & Shardeum testnets)
- **Web3**: ethers.js v5
- **Storage**: IPFS via Pinata

## 📁 Project Structure

```
ethereum-gpu-depin/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/           # Contract source files
│   ├── test/          # Contract tests
│   └── script/        # Deployment scripts
├── frontend/          # React frontend
│   └── src/
│       ├── pages/     # Provider & Consumer dashboards
│       ├── hooks/     # React hooks for Web3
│       ├── config/    # Contract addresses & ABIs
│       └── utils/     # IPFS utilities
└── provider-worker/   # GPU worker for job execution
```

## 🏃 Quick Start

### Prerequisites

- Node.js v18+
- MetaMask browser extension
- Testnet tokens (Sepolia ETH or Shardeum SHM)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Smart Contracts

```bash
cd contracts
forge install
forge test
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## 💡 How It Works

1. **Provider** registers GPU with model, VRAM, and hourly price
2. **Consumer** browses available GPUs and posts a job with payment
3. **Payment** locked in smart contract escrow
4. **Provider** claims job and completes work
5. **Payment** automatically released (95% to provider, 5% platform fee)

## 🔗 Get Testnet Tokens

- **Sepolia**: https://sepoliafaucet.com/
- **Shardeum**: https://faucet-sphinx.shardeum.org/

## 🎨 UI Features

- Dark theme with green accents
- Network switcher (Sepolia ↔ Shardeum)
- Real-time job notifications
- Dynamic currency display
- Responsive design

## 📜 Smart Contract Overview

### GPURegistry.sol
- Register GPU resources
- Update pricing and availability
- Track provider statistics

### JobMarketplace.sol
- Post jobs with ETH/SHM payment
- Claim jobs by providers
- Complete jobs with results
- Automatic escrow and payment release

## 🔐 Security

- No private keys in code
- Environment variables for sensitive data
- Smart contract access controls
- Input validation on all functions

## 📝 License

MIT License

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

---

Built with 🥦 by the BroccoByte team
