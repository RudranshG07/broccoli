import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "./hooks/useWallet";
import ProviderDashboard from "./pages/ProviderDashboard";
import ConsumerDashboard from "./pages/ConsumerDashboard";
import { NETWORKS, SUPPORTED_CHAIN_IDS, getNetworkName } from "./config/contracts";

function App() {
  const { address, connectWallet, disconnectWallet, isConnecting, error } = useWallet();
  const [view, setView] = useState<"provider" | "consumer">("provider");
  const [balance, setBalance] = useState<string>("0");
  const [network, setNetwork] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  useEffect(() => {
    const loadWalletData = async () => {
      if (address && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);

          // Get balance
          const bal = await provider.getBalance(address);
          setBalance(ethers.utils.formatEther(bal));

          // Get network
          const net = await provider.getNetwork();
          setChainId(net.chainId);
          setNetwork(getNetworkName(net.chainId));
        } catch (err) {
          console.error("Failed to load wallet data:", err);
        }
      }
    };

    loadWalletData();
    const interval = setInterval(loadWalletData, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [address]);

  // Listen for network changes
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = async (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        setNetwork(getNetworkName(newChainId));

        // Reload wallet data
        if (address) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const bal = await provider.getBalance(address);
          setBalance(ethers.utils.formatEther(bal));
        }
      };
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [address]);

  const switchNetwork = async (targetChainId: number) => {
    try {
      const targetNetwork = targetChainId === 11155111 ? NETWORKS.sepolia : NETWORKS.shardeum;

      console.log(`Switching to ${targetNetwork.name} (Chain ID: ${targetChainId})`);

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetNetwork.chainIdHex }],
      });
      setShowNetworkDropdown(false);
      console.log(`Successfully switched to ${targetNetwork.name}`);
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          const targetNetwork = targetChainId === 11155111 ? NETWORKS.sepolia : NETWORKS.shardeum;

          const nativeCurrency = targetChainId === 8119
            ? { name: 'Shardeum', symbol: 'SHM', decimals: 18 }
            : { name: 'Ethereum', symbol: 'ETH', decimals: 18 };

          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: targetNetwork.chainIdHex,
                chainName: targetNetwork.name,
                rpcUrls: [targetNetwork.rpcUrl],
                blockExplorerUrls: [targetNetwork.blockExplorer],
                nativeCurrency: nativeCurrency,
              },
            ],
          });
          setShowNetworkDropdown(false);
        } catch (addError: any) {
          console.error('Failed to add network:', addError);
          alert(`Failed to add network: ${addError.message || 'Please try again'}`);
        }
      } else if (switchError.code === 4001) {
        // User rejected the request
        console.log('User rejected network switch');
      } else {
        console.error('Failed to switch network:', switchError);
        alert(`Failed to switch network: ${switchError.message || 'Please try again'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Header */}
      <header className="bg-black border-b border-green-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img src="/logo.png" alt="BroccoByte Logo" className="h-12 w-12 object-contain mix-blend-lighten" style={{backgroundColor: 'transparent'}} />
                <h1 className="text-3xl font-bold text-green-400">BroccoByte</h1>
              </div>
              {address && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setView("provider")}
                    className={`px-4 py-2 rounded-none ${
                      view === "provider"
                        ? "bg-green-500 text-black font-semibold"
                        : "bg-gray-900 text-green-400 hover:bg-gray-800 border border-green-500"
                    }`}
                  >
                    Provider
                  </button>
                  <button
                    onClick={() => setView("consumer")}
                    className={`px-4 py-2 rounded-none ${
                      view === "consumer"
                        ? "bg-green-500 text-black font-semibold"
                        : "bg-gray-900 text-green-400 hover:bg-gray-800 border border-green-500"
                    }`}
                  >
                    Consumer
                  </button>
                </div>
              )}
            </div>
            <div>
              {!address ? (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="bg-green-500 hover:bg-green-600 text-black px-6 py-2 rounded-none font-bold disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect MetaMask"}
                </button>
              ) : (
                <div className="flex items-center space-x-4">
                  {/* Network Switcher */}
                  <div className="relative">
                    <button
                      onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                      className={`px-4 py-2 rounded-none text-sm font-semibold border-2 ${
                        SUPPORTED_CHAIN_IDS.includes(chainId)
                          ? "border-green-500 bg-green-500/20 text-green-400"
                          : "border-red-500 bg-red-500/20 text-red-400"
                      }`}
                    >
                      {network || "Unknown Network"} ▼
                    </button>
                    {showNetworkDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-gray-900 border-2 border-green-500 rounded-none shadow-lg z-50">
                        <button
                          onClick={() => switchNetwork(11155111)}
                          className={`block w-full text-left px-4 py-2 hover:bg-gray-800 ${
                            chainId === 11155111 ? "text-green-400 bg-gray-800" : "text-white"
                          }`}
                        >
                          Sepolia
                        </button>
                        <button
                          onClick={() => switchNetwork(8119)}
                          className={`block w-full text-left px-4 py-2 hover:bg-gray-800 ${
                            chainId === 8119 ? "text-green-400 bg-gray-800" : "text-white"
                          }`}
                        >
                          Shardeum
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-400">
                      {parseFloat(balance).toFixed(4)} ETH
                    </div>
                    <div className="text-xs text-gray-500">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="bg-gray-900 hover:bg-gray-800 text-green-400 px-4 py-2 rounded-none text-sm border border-green-500"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-4 bg-green-900/50 border border-green-700 text-green-200 px-4 py-2 rounded-none">
              {error}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!address ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-8">
              <img src="/logo.png" alt="BroccoByte Logo" className="h-32 w-32 object-contain mix-blend-lighten" style={{backgroundColor: 'transparent'}} />
            </div>
            <h2 className="text-4xl font-bold mb-4 text-green-400">Welcome to BroccoByte</h2>
            <p className="text-gray-400 mb-8">
              Connect your MetaMask wallet to get started
            </p>
            <p className="text-sm text-gray-500">
              Supports Sepolia and Shardeum testnets
            </p>
          </div>
        ) : (
          <div>
            {view === "provider" ? (
              <ProviderDashboard address={address} currentChainId={chainId} />
            ) : (
              <ConsumerDashboard address={address} currentChainId={chainId} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
