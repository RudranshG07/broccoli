import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { SEPOLIA_CHAIN_ID } from "../config/contracts";

export const useWallet = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const web3Signer = web3Provider.getSigner();
      const userAddress = await web3Signer.getAddress();

      // Check network
      const network = await web3Provider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            throw new Error("Please add Sepolia network to MetaMask");
          }
          throw switchError;
        }
      }

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
      console.error("Wallet connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setError(null);
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAddress(accounts[0]);
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
        window.ethereum.removeAllListeners("chainChanged");
      }
    };
  }, []);

  return {
    address,
    provider,
    signer,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
  };
};
