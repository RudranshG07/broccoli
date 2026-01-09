# DePIN GPU Sharing Platform

A decentralized platform for GPU sharing on Ethereum Sepolia testnet. Providers can register their GPUs and consumers can rent them for compute tasks, with automatic escrow payments.

## Features

- **Provider Dashboard**: Register GPUs, manage availability, claim and complete jobs
- **Consumer Dashboard**: Browse available GPUs, post jobs, track job status
- **Smart Contract Escrow**: Secure payments with automatic release upon job completion
- **Real-time Sync**: Blockchain events update both laptops instantly
- **Cross-Laptop Communication**: Pure blockchain coordination, no backend needed

## Architecture

### Smart Contracts (Solidity + Foundry)
- **GPURegistry.sol**: GPU registration and management
- **JobMarketplace.sol**: Job posting, claiming, and payment escrow

### Frontend (React + Vite + TypeScript)
- **MetaMask Integration**: Wallet connection and transaction signing
- **Real-time Updates**: Event listeners for cross-laptop synchronization
- **Tailwind CSS**: Modern, responsive UI

## Project Structure

```
ethereum-gpu-depin/
├── contracts/              # Foundry project
│   ├── src/
│   │   ├── GPURegistry.sol
│   │   └── JobMarketplace.sol
│   ├── test/
│   │   ├── GPURegistry.t.sol
│   │   └── JobMarketplace.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
│
└── frontend/              # React + Vite
    ├── src/
    │   ├── config/
    │   │   └── contracts.ts      # Contract addresses and ABIs
    │   ├── hooks/
    │   │   └── useWallet.ts
    │   ├── pages/
    │   │   ├── ProviderDashboard.tsx
    │   │   └── ConsumerDashboard.tsx
    │   └── types/
    │       └── index.ts
    └── package.json
```

## Setup & Deployment

### Prerequisites

1. **Install Foundry**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Install Node.js** (v18+)
   - Download from [nodejs.org](https://nodejs.org/)

3. **MetaMask Browser Extension**
   - Install from [metamask.io](https://metamask.io/)
   - Add Sepolia testnet
   - Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)

### Step 1: Test Smart Contracts

```bash
cd contracts
forge test -vv
```

Expected output: `25 tests passed`

### Step 2: Deploy to Sepolia

1. **Create .env file**
   ```bash
   cd contracts
   cp .env.example .env
   ```

2. **Add your credentials to `.env`**
   ```bash
   PRIVATE_KEY=your_private_key_here
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

   **Getting these values:**
   - **PRIVATE_KEY**: Export from MetaMask (Account Details → Export Private Key)
   - **SEPOLIA_RPC_URL**: Sign up at [Infura.io](https://infura.io/) or [Alchemy.com](https://alchemy.com/)
   - **ETHERSCAN_API_KEY**: Get from [Etherscan.io](https://etherscan.io/myapikey)

3. **Deploy contracts**
   ```bash
   source .env
   forge script script/Deploy.s.sol \
     --rpc-url $SEPOLIA_RPC_URL \
     --broadcast \
     --verify \
     -vvvv
   ```

4. **Save the contract addresses**
   ```
   GPURegistry: 0xABC123...
   JobMarketplace: 0xDEF456...
   ```

### Step 3: Update Frontend Config

Edit `frontend/src/config/contracts.ts`:

```typescript
export const CONTRACTS = {
  sepolia: {
    gpuRegistry: "0xYOUR_GPU_REGISTRY_ADDRESS",      // From Step 2
    jobMarketplace: "0xYOUR_JOB_MARKETPLACE_ADDRESS", // From Step 2
  },
};
```

### Step 4: Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Testing on Two Laptops

### Setup

**Laptop A (Provider):**
1. Open http://localhost:5173
2. Connect MetaMask with Provider wallet
3. Switch to Provider dashboard

**Laptop B (Consumer):**
1. Clone the repo: `git clone <your-repo>`
2. Run `cd ethereum-gpu-depin/frontend && npm install && npm run dev`
3. Open http://localhost:5173
4. Connect MetaMask with Consumer wallet (different address)
5. Switch to Consumer dashboard

### Demo Flow

1. **Laptop A**: Register GPU
   - Model: "RTX 4090"
   - VRAM: 24 GB
   - Price: 0.01 ETH/hour
   - Click "Register GPU"
   - Approve MetaMask transaction

2. **Laptop B**: Refresh page (or wait 12 seconds)
   - See GPU appear in "Available GPUs"
   - Click on the GPU card to select it

3. **Laptop B**: Post Job
   - Description: "Train AI model"
   - Compute Hours: 2
   - Payment: 0.02 ETH
   - Click "Post Job"
   - Approve MetaMask transaction

4. **Laptop A**: Refresh or wait for event
   - See new job in "My Jobs" section
   - Click "Complete Job"
   - Enter result hash (e.g., "ipfs://QmExample...")
   - Approve MetaMask transaction
   - **Payment automatically released!** (0.019 ETH to provider, 5% platform fee)

5. **Laptop B**: See job status update to "Completed"
   - View result hash

### Troubleshooting

**"MetaMask is not installed"**
- Install MetaMask browser extension

**"Please add Sepolia network to MetaMask"**
- In MetaMask, go to Settings → Networks → Add Network
- Network Name: Sepolia
- RPC URL: https://sepolia.infura.io/v3/YOUR_KEY
- Chain ID: 11155111
- Currency Symbol: ETH

**"Contracts not deployed yet!"**
- Make sure you updated `frontend/src/config/contracts.ts` with deployed addresses

**"Transaction failed"**
- Ensure you have enough Sepolia ETH
- Check if you're on Sepolia network
- Try increasing gas limit in MetaMask

**"GPUs not showing up on Laptop B"**
- Wait 12-15 seconds for blockchain confirmation
- Refresh the page
- Check both wallets are on Sepolia

## Smart Contract Details

### GPURegistry.sol

**Key Functions:**
- `registerGPU(model, vramGB, pricePerHour)` - Register new GPU
- `setAvailability(gpuId, available)` - Toggle GPU availability
- `getAvailableGPUs()` - Get all available GPU IDs
- `getProviderGPUs(address)` - Get GPUs owned by provider

**Events:**
- `GPURegistered(gpuId, provider, model, pricePerHour)`
- `GPUAvailabilityUpdated(gpuId, available)`

### JobMarketplace.sol

**Key Functions:**
- `postJob(gpuId, description, computeHours)` payable - Post job with ETH
- `claimJob(jobId)` - Provider claims job
- `completeJob(jobId, resultHash)` - Complete job and release payment
- `getOpenJobs()` - Get all open jobs

**Payment Flow:**
- Consumer posts job → ETH locked in contract
- Provider completes job → 95% to provider, 5% platform fee
- Automatic payment release (no manual approval needed)

**Events:**
- `JobPosted(jobId, consumer, gpuId, paymentAmount)`
- `JobClaimed(jobId, provider)`
- `JobCompleted(jobId, resultHash)`
- `PaymentReleased(jobId, provider, amount)`

## Development

### Run Tests
```bash
cd contracts
forge test -vv
```

### Test Coverage
```bash
forge coverage
```

### Gas Report
```bash
forge test --gas-report
```

### Build Frontend
```bash
cd frontend
npm run build
```

## Deployment Options

### Option 1: Run Locally on Both Laptops (Recommended for Testing)
Both laptops run `npm run dev` on localhost:5173
- Clone repo on both machines
- Same contract addresses in config
- Different MetaMask wallets

### Option 2: Deploy Frontend to Vercel (Recommended for Demo)
1. Push code to GitHub
2. Import to [Vercel](https://vercel.com/)
3. Set base directory to `frontend`
4. Deploy
5. Share URL with everyone (e.g., https://your-app.vercel.app)
6. Both users access same URL, connect different wallets

## Technical Notes

### How Cross-Laptop Sync Works

```
Laptop A (Provider)         Sepolia Blockchain         Laptop B (Consumer)
     |                              |                          |
     | registerGPU()                |                          |
     |----------------------------->|                          |
     |                              | GPURegistered event      |
     |                              |------------------------>|
     |                              |                          | GPU appears in UI
     |                              |                          |
     |                              | postJob() + ETH         |
     |                              |<------------------------|
     | JobPosted event              |                          |
     |<-----------------------------|                          |
     | Job appears in UI            |                          |
```

**Key Points:**
- No WebSocket server needed
- No backend API required
- Pure blockchain events
- Both frontends listen to the same contract
- Updates typically arrive within 12 seconds (block time)

## Security

- **Escrow Protection**: Payments locked in smart contract
- **Provider Verification**: Only GPU owner can claim jobs
- **Refund Mechanism**: Consumer can cancel after 24 hours if unclaimed
- **Platform Fee**: 5% fee on all transactions

## Future Enhancements

- Reputation system for providers
- Job templates for common tasks
- IPFS integration for large result files
- Real GPU compute verification (ZK proofs)
- Token economics with staking
- The Graph indexer for faster queries

## License

MIT

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review Sepolia Etherscan for transaction details
3. Open an issue on GitHub

## Demo Video

Coming soon!

---

Built with ❤️ for the DePIN ecosystem
# rent-gpu
