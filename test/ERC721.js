const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("ERC721", function () {
  async function deployToken() {
    const [creator, user1, user2] = await ethers.getSigners();

    const ERC721 = await ethers.getContractFactory("ERC721");
    const token = await ERC721.deploy();

    return { token, creator, user1, user2 };
  }

  async function deployThenMint(order) {
    const { token, creator, user1, user2 } = await loadFixture(deployToken);
    const users = [creator, user1, user2];
    for (const u of order) {
      await token.mint(users[u]);
    }
    return { token, creator, user1, user2 };
  }

  describe("Ownership", () => {
    it("Constructor should set the right owner", async () => {
      const { token, creator } = await loadFixture(deployToken);

      expect(await token.owner()).to.equal(creator.address);
    });

    it("The owner can transfer ownership", async () => {
      const { token, user1 } = await loadFixture(deployToken);

      await expect(token.changeOwner(user1.address))
        .not.to.be.reverted;
    });

    it("The new owner can transfer ownership", async () => {
      const { token, creator, user1 } = await loadFixture(deployToken);
      await token.changeOwner(user1.address);

      await expect(token.connect(user1).changeOwner(creator.address))
        .not.to.be.reverted;
    });

    it("changeOwner changes owner", async () => {
      const { token, user1 } = await loadFixture(deployToken);
      await token.changeOwner(user1.address);

      expect(await token.owner()).to.equal(user1.address);
    });

    it("Others can't change ownership", async () => {
      const { token, creator, user1 } = await loadFixture(deployToken);

      await expect(token.connect(user1).changeOwner(creator.address))
        .to.be.reverted;

      await token.changeOwner(user1.address);
      await expect(token.changeOwner(creator.address))
        .to.be.reverted;
    });
  });

  describe("Mint", () => {
    it("should be only allowed to call by the owner", async () => {
      const { token, user1 } = await loadFixture(deployToken);

      await expect(token.connect(user1).mint(user1.address))
        .to.be.reverted;
    });

    it("should only produce tokens 1, 2, ... 5", async () => {
      const { token, creator } = await loadFixture(deployToken);

      for (const i of [1, 2, 3, 4, 5]) {
        await expect(token.mint(creator.address))
          .to.emit(token, "Mint")
          .withArgs(creator.address, i);
      }
      await expect(token.mint(creator.address))
        .to.be.reverted;
    });

    it("should change reciever's balance", async () => {
      const { token, creator, user1, user2 } =
        await deployThenMint([1, 1, 2, 2, 2]);

      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.balanceOf(user1.address)).to.equal(2);
      expect(await token.balanceOf(user2.address)).to.equal(3);
    });

    it("should set token's owner", async () => {
      const { token, user1, user2 } =
        await deployThenMint([1, 2, 1]);

      expect(await token.ownerOf(1)).to.equal(user1.address);
      expect(await token.ownerOf(2)).to.equal(user2.address);
      expect(await token.ownerOf(3)).to.equal(user1.address);
    });
  });

  describe("tokenUri", () => {
    it("should be the correct one", async () => {
      const { token } = await deployThenMint([1, 1, 1, 1, 1]);
      const TIGER_URI = "https://gateway.pinata.cloud/ipfs/QmQmeo8rzNHfAwJ1RHS25x53NkqYc3Z3NsRem3J8LYcLhr/1";
      const DOG_URI = "https://gateway.pinata.cloud/ipfs/QmQmeo8rzNHfAwJ1RHS25x53NkqYc3Z3NsRem3J8LYcLhr/5";

      expect(await token.tokenURI(1)).to.equal(TIGER_URI);
      expect(await token.tokenURI(5)).to.equal(DOG_URI);
    });

    it("should be reverted for not existing tokens", async () => {
      const { token } = await deployThenMint([1, 1,]);

      await expect(token.tokenURI(3))
        .to.be.reverted;
      await expect(token.tokenURI(0))
        .to.be.reverted;
      await expect(token.tokenURI(6))
        .to.be.reverted;
    });
  });

  describe("approve", () => {
    it("should be allowed for the token's owner", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1).approve(user2.address, 1))
        .not.to.be.reverted;
      await expect(token.connect(user1).approve(user2.address, 3))
        .not.to.be.reverted;
    });

    it("should be allowed for the token's operator", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).approve(user2.address, 1);

      await expect(token.connect(user2).approve(creator.address, 1))
        .not.to.be.reverted;
    });

    it("should be allowed for the user's operator", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).setApprovalForAll(user2.address, true);

      await expect(token.connect(user2).approve(creator.address, 1))
        .not.to.be.reverted;
    });

    it("shouldn't be allowed for others", async () => {
      const { token, creator, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user2).approve(creator.address, 1))
        .to.be.reverted;
    });

    it("should change getApproved output", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).approve(user2.address, 3);

      expect(await token.getApproved(3)).to.equal(user2.address);
    });

    it("should emit the event", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1).approve(user2.address, 3))
        .to.emit(token, "Approval")
        .withArgs(user1.address, user2.address, 3);
    });

    it("shouldn't change the owner", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).approve(user2.address, 3);

      expect(await token.ownerOf(3)).to.equal(user1.address);
    });

    it("It shouldn't be allowed to approve for owner", async () => {
      const { token, user1 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1).approve(user1.address, 3))
        .to.be.reverted;
    });
  });

  describe("setApprovalForAll", () => {
    it("should be allowed for the token's owner", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1).setApprovalForAll(user2.address, true))
        .not.to.be.reverted;
      await expect(token.connect(user1).setApprovalForAll(user2.address, false))
        .not.to.be.reverted;
    });

    it("should change isApprovedForAll output", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await token.connect(user1).setApprovalForAll(user2.address, true);

      expect(await token.isApprovedForAll(user1.address, user2.address))
        .to.be.true;

      await token.connect(user1).setApprovalForAll(user2.address, false);

      expect(await token.isApprovedForAll(user1.address, user2.address))
        .to.be.false;
    });

    it("should emit the event", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1).setApprovalForAll(user2.address, true))
        .to.emit(token, "ApprovalForAll")
        .withArgs(user1.address, user2.address, true);
      await expect(token.connect(user1).setApprovalForAll(user2.address, false))
        .to.emit(token, "ApprovalForAll")
        .withArgs(user1.address, user2.address, false);
    });

    it("shouldn't change the owner", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).setApprovalForAll(user2.address, true);

      expect(await token.ownerOf(3)).to.equal(user1.address);
    });

    it("It shouldn't be allowed to approve for owner", async () => {
      const { token, user1 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1).setApprovalForAll(user1.address, true))
        .to.be.reverted;
      await expect(token.connect(user1).setApprovalForAll(user1.address, false))
        .to.be.reverted;
    });
  });

  describe("Transfer", () => {
    it("should be allowed for the owner", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1)
        .transferFrom(user1.address, user2.address, 1))
        .not.to.be.reverted;
      await expect(token.connect(user1)
        .transferFrom(user1.address, user2.address, 2))
        .not.to.be.reverted;
      await expect(token.connect(user1)
        .transferFrom(user1.address, user2.address, 3))
        .not.to.be.reverted;
    });

    it("should be allowed for the token's operator", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).approve(user2.address, 1);

      await expect(token.connect(user2)
        .transferFrom(user1.address, creator.address, 1))
        .not.to.be.reverted;
    });

    it("should be allowed for the user's operator", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).setApprovalForAll(user2.address, true);

      await expect(token.connect(user2)
        .transferFrom(user1.address, creator.address, 1))
        .not.to.be.reverted;
    });

    it("shouldn't be allowed for other's tokens", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 0]);
      await token.connect(user1).setApprovalForAll(user2.address, true);

      await expect(token.connect(user2)
        .transferFrom(user1.address, creator.address, 3))
        .to.be.reverted;
    });

    it("shouldn't be allowed for others", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user2)
        .transferFrom(user1.address, creator.address, 1))
        .to.be.reverted;
    });

    it("shouldn't be allowed for ex operators", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).setApprovalForAll(user2.address, true);
      await token.connect(user1).setApprovalForAll(user2.address, false);

      await expect(token.connect(user2)
        .transferFrom(user1.address, creator.address, 1))
        .to.be.reverted;
    });

    it("should change ownerOf", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1)
        .transferFrom(user1.address, user2.address, 1);

      expect(await token.ownerOf(1)).to.equal(user2.address);
    });

    it("should change balances", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1)
        .transferFrom(user1.address, user2.address, 1);

      expect(await token.balanceOf(user1.address)).to.equal(2);
      expect(await token.balanceOf(user2.address)).to.equal(1);
    });

    it("should emit the event", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1)
        .transferFrom(user1.address, user2.address, 1))
        .to.emit(token, "Transfer")
        .withArgs(user1.address, user2.address, 1);
    });

    it("should clear permissions", async () => {
      const { token, creator, user1, user2 } = await deployThenMint([1, 1, 1]);
      await token.connect(user1).approve(user2.address, 2);
      await token.connect(user2)
        .transferFrom(user1.address, creator.address, 2);

      expect(await token.getApproved(2)).not.to.equal(user2.address);
      await expect(token.connect(user2)
        .transferFrom(creator.address, user2.address, 2))
        .to.be.reverted;
    });
  });

  describe("Support interface", () => {
    it("ERC721", async () => {
      const { token } = await deployThenMint([1, 1, 1]);

      expect(await token.supportsInterface("0x80ac58cd"))
        .to.be.true;
    });

    it("ERC1155", async () => {
      const { token } = await deployThenMint([1, 1, 1]);

      expect(await token.supportsInterface("0xd9b67a26"))
        .to.be.false;
    });
  });

  describe("Safe transfer", () => {
    it("Transfer to user accounts is allowed", async () => {
      const { token, user1, user2 } = await deployThenMint([1, 1, 1]);

      await expect(token.connect(user1)
        .safeTransferFrom(user1.address, user2.address, 1))
        .not.to.be.reverted;
    });
  })
});
