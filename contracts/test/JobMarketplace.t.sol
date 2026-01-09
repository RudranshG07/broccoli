// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GPURegistry.sol";
import "../src/JobMarketplace.sol";

contract JobMarketplaceTest is Test {
    GPURegistry public registry;
    JobMarketplace public marketplace;

    address public provider = address(0x1);
    address public consumer = address(0x2);

    function setUp() public {
        registry = new GPURegistry();
        marketplace = new JobMarketplace(address(registry));

        vm.deal(consumer, 10 ether);
        vm.deal(provider, 1 ether);
    }

    function testPostJob() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.02 ether}(
            gpuId,
            "Train AI model",
            2
        );

        assertEq(jobId, 0);

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(job.consumer, consumer);
        assertEq(job.gpuId, gpuId);
        assertEq(job.description, "Train AI model");
        assertEq(job.computeHours, 2);
        assertEq(job.paymentAmount, 0.02 ether);
        assertEq(uint(job.status), uint(JobMarketplace.JobStatus.Open));
    }

    function testClaimJob() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.02 ether}(
            gpuId,
            "Train AI model",
            2
        );

        vm.prank(provider);
        marketplace.claimJob(jobId);

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(job.provider, provider);
        assertEq(uint(job.status), uint(JobMarketplace.JobStatus.Claimed));
    }

    function testCompleteJobAndPayment() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 1 ether}(
            gpuId,
            "Train AI model",
            2
        );

        vm.prank(provider);
        marketplace.claimJob(jobId);

        uint256 providerBalanceBefore = provider.balance;

        vm.prank(provider);
        marketplace.completeJob(jobId, "ipfs://QmResultHash");

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(uint(job.status), uint(JobMarketplace.JobStatus.Completed));
        assertEq(job.resultHash, "ipfs://QmResultHash");

        uint256 expectedPayment = (1 ether * 95) / 100;
        assertEq(provider.balance, providerBalanceBefore + expectedPayment);

        assertEq(marketplace.platformFees(), 0.05 ether);
    }

    function testCancelJobByConsumer() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.5 ether}(
            gpuId,
            "Train AI model",
            2
        );

        uint256 consumerBalanceBefore = consumer.balance;

        vm.prank(consumer);
        marketplace.cancelJob(jobId);

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(uint(job.status), uint(JobMarketplace.JobStatus.Cancelled));

        assertEq(consumer.balance, consumerBalanceBefore + 0.5 ether);
    }

    function testCancelJobAfter24Hours() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.5 ether}(
            gpuId,
            "Train AI model",
            2
        );

        vm.prank(provider);
        marketplace.claimJob(jobId);

        vm.warp(block.timestamp + 25 hours);

        uint256 consumerBalanceBefore = consumer.balance;

        vm.prank(consumer);
        marketplace.cancelJob(jobId);

        assertEq(consumer.balance, consumerBalanceBefore + 0.5 ether);
    }

    function testRevertCancelJobBefore24Hours() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.5 ether}(
            gpuId,
            "Train AI model",
            2
        );

        vm.prank(provider);
        marketplace.claimJob(jobId);

        vm.warp(block.timestamp + 12 hours);

        vm.prank(consumer);
        vm.expectRevert("Cannot cancel yet, wait 24 hours");
        marketplace.cancelJob(jobId);
    }

    function testRevertNonProviderClaimJob() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.02 ether}(
            gpuId,
            "Train AI model",
            2
        );

        address attacker = address(0x3);
        vm.prank(attacker);
        vm.expectRevert("Only GPU provider can claim");
        marketplace.claimJob(jobId);
    }

    function testRevertNonProviderCompleteJob() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.02 ether}(
            gpuId,
            "Train AI model",
            2
        );

        vm.prank(provider);
        marketplace.claimJob(jobId);

        vm.prank(consumer);
        vm.expectRevert("Only provider can complete");
        marketplace.completeJob(jobId, "ipfs://QmResultHash");
    }

    function testGetOpenJobs() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        marketplace.postJob{value: 0.02 ether}(gpuId, "Job 1", 2);

        vm.prank(consumer);
        uint256 jobId2 = marketplace.postJob{value: 0.03 ether}(gpuId, "Job 2", 3);

        vm.prank(provider);
        marketplace.claimJob(jobId2);

        uint256[] memory openJobs = marketplace.getOpenJobs();
        assertEq(openJobs.length, 1);
        assertEq(openJobs[0], 0);
    }

    function testGetConsumerJobs() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        marketplace.postJob{value: 0.02 ether}(gpuId, "Job 1", 2);

        vm.prank(consumer);
        marketplace.postJob{value: 0.03 ether}(gpuId, "Job 2", 3);

        uint256[] memory consumerJobs = marketplace.getConsumerJobs(consumer);
        assertEq(consumerJobs.length, 2);
    }

    function testGetProviderJobs() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        uint256 jobId = marketplace.postJob{value: 0.02 ether}(gpuId, "Job 1", 2);

        vm.prank(provider);
        marketplace.claimJob(jobId);

        uint256[] memory providerJobs = marketplace.getProviderJobs(provider);
        assertEq(providerJobs.length, 1);
        assertEq(providerJobs[0], 0);
    }

    function testRevertPostJobWithZeroPayment() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        vm.expectRevert("Payment must be greater than 0");
        marketplace.postJob{value: 0}(gpuId, "Train AI model", 2);
    }

    function testRevertPostJobWithEmptyDescription() public {
        vm.prank(provider);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(consumer);
        vm.expectRevert("Description cannot be empty");
        marketplace.postJob{value: 0.02 ether}(gpuId, "", 2);
    }
}
