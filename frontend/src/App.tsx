import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "./hooks/useWallet";
import ProviderDashboard from "./pages/ProviderDashboard";
import ConsumerDashboard from "./pages/ConsumerDashboard";

function App() {
  const { address, connectWallet, disconnectWallet, isConnecting, error } = useWallet();
  const [view, setView] = useState<"provider" | "consumer">("provider");
  const [balance, setBalance] = useState<string>("0");
  const [network, setNetwork] = useState<string>("");

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
          setNetwork(net.name === "sepolia" ? "Sepolia Testnet" : net.name);
        } catch (err) {
          console.error("Failed to load wallet data:", err);
        }
      }
    };

    loadWalletData();
    const interval = setInterval(loadWalletData, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [address]);

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
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {network && (
                        <span className={network === "Sepolia Testnet" ? "text-green-400" : "text-red-400"}>
                          {network}
                        </span>
                      )}
                    </div>
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
              Make sure you're on Sepolia testnet
            </p>
          </div>
        ) : (
          <div>
            {view === "provider" ? (
              <ProviderDashboard address={address} />
            ) : (
              <ConsumerDashboard address={address} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
