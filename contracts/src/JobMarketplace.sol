// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GPURegistry.sol";

contract JobMarketplace {
    enum JobStatus {
        Open,
        Claimed,
        Completed,
        Cancelled
    }

    struct Job {
        uint256 jobId;
        address consumer;
        uint256 gpuId;
        string description;
        uint256 computeHours;
        uint256 paymentAmount;
        address provider;
        JobStatus status;
        uint256 createdAt;
        uint256 claimedAt;
        uint256 completedAt;
        string resultHash;
    }

    GPURegistry public gpuRegistry;
    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;
    mapping(address => uint256[]) public consumerJobs;
    mapping(address => uint256[]) public providerJobs;

    uint256 public constant PLATFORM_FEE_PERCENT = 5;
    uint256 public platformFees;

    event JobPosted(
        uint256 indexed jobId,
        address indexed consumer,
        uint256 indexed gpuId,
        uint256 paymentAmount
    );
    event JobClaimed(uint256 indexed jobId, address indexed provider);
    event JobCompleted(uint256 indexed jobId, string resultHash);
    event PaymentReleased(
        uint256 indexed jobId,
        address indexed provider,
        uint256 amount
    );
    event JobCancelled(uint256 indexed jobId);

    constructor(address _gpuRegistryAddress) {
        gpuRegistry = GPURegistry(_gpuRegistryAddress);
    }

    function postJob(
        uint256 gpuId,
        string memory description,
        uint256 computeHours
    ) external payable returns (uint256) {
        require(bytes(description).length > 0, "Description cannot be empty");
        require(computeHours > 0, "Compute hours must be greater than 0");
        require(msg.value > 0, "Payment must be greater than 0");

        GPURegistry.GPU memory gpu = gpuRegistry.getGPU(gpuId);
        require(gpu.available, "GPU is not available");

        uint256 jobId = nextJobId++;

        jobs[jobId] = Job({
            jobId: jobId,
            consumer: msg.sender,
            gpuId: gpuId,
            description: description,
            computeHours: computeHours,
            paymentAmount: msg.value,
            provider: address(0),
            status: JobStatus.Open,
            createdAt: block.timestamp,
            claimedAt: 0,
            completedAt: 0,
            resultHash: ""
        });

        consumerJobs[msg.sender].push(jobId);

        emit JobPosted(jobId, msg.sender, gpuId, msg.value);

        return jobId;
    }

    function claimJob(uint256 jobId) external {
        require(jobId < nextJobId, "Job does not exist");
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Open, "Job is not open");

        GPURegistry.GPU memory gpu = gpuRegistry.getGPU(job.gpuId);
        require(msg.sender == gpu.provider, "Only GPU provider can claim");

        job.provider = msg.sender;
        job.status = JobStatus.Claimed;
        job.claimedAt = block.timestamp;

        providerJobs[msg.sender].push(jobId);

        emit JobClaimed(jobId, msg.sender);
    }

    function completeJob(uint256 jobId, string memory resultHash) external {
        require(jobId < nextJobId, "Job does not exist");
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Claimed, "Job is not claimed");
        require(msg.sender == job.provider, "Only provider can complete");
        require(bytes(resultHash).length > 0, "Result hash cannot be empty");

        job.status = JobStatus.Completed;
        job.completedAt = block.timestamp;
        job.resultHash = resultHash;

        gpuRegistry.incrementJobCount(job.gpuId);

        uint256 platformFee = (job.paymentAmount * PLATFORM_FEE_PERCENT) / 100;
        uint256 providerPayment = job.paymentAmount - platformFee;

        platformFees += platformFee;

        (bool success, ) = payable(job.provider).call{value: providerPayment}("");
        require(success, "Payment transfer failed");

        emit JobCompleted(jobId, resultHash);
        emit PaymentReleased(jobId, job.provider, providerPayment);
    }

    function cancelJob(uint256 jobId) external {
        require(jobId < nextJobId, "Job does not exist");
        Job storage job = jobs[jobId];
        require(msg.sender == job.consumer, "Only consumer can cancel");
        require(
            job.status == JobStatus.Open || job.status == JobStatus.Claimed,
            "Job cannot be cancelled"
        );

        if (job.status == JobStatus.Claimed) {
            require(
                block.timestamp > job.claimedAt + 24 hours,
                "Cannot cancel yet, wait 24 hours"
            );
        }

        job.status = JobStatus.Cancelled;

        (bool success, ) = payable(job.consumer).call{value: job.paymentAmount}("");
        require(success, "Refund transfer failed");

        emit JobCancelled(jobId);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        require(jobId < nextJobId, "Job does not exist");
        return jobs[jobId];
    }

    function getOpenJobs() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextJobId; i++) {
            if (jobs[i].status == JobStatus.Open) {
                count++;
            }
        }

        uint256[] memory openJobs = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextJobId; i++) {
            if (jobs[i].status == JobStatus.Open) {
                openJobs[index] = i;
                index++;
            }
        }

        return openJobs;
    }

    function getConsumerJobs(address consumer) external view returns (uint256[] memory) {
        return consumerJobs[consumer];
    }

    function getProviderJobs(address provider) external view returns (uint256[] memory) {
        return providerJobs[provider];
    }

    receive() external payable {}
}
