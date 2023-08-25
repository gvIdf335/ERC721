// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

contract Owned {
    address public owner;

    constructor () {
        owner = msg.sender;
    }

    modifier ownerOnly() {
        require(msg.sender == owner, "This function can only be called by the owner");
        _;
    }

    function changeOwner(address newOwner) public ownerOnly {
        owner = newOwner;
    }
}

interface IERC165 {

    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721Receiver {

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

interface IERC721 {

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool _approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC721Metadata {

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

abstract contract ERC165 is IERC165 {

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}


contract ERC721 is IERC721, IERC721Metadata, ERC165, Owned {

    event Mint(address _to, uint256 _tokenId);

    string constant _name = "Animalia";
    string constant _symbol = "ANIM";

    string constant public baseUri = "https://gateway.pinata.cloud/ipfs/QmQmeo8rzNHfAwJ1RHS25x53NkqYc3Z3NsRem3J8LYcLhr/";

    uint256 public tokenId = 0;

    mapping (uint256 => address) owners;
    mapping (address => uint256) balances;

    mapping(uint256 => address) tokenApprovals;
    mapping(address => mapping(address => bool)) operatorApprovals;

    constructor () {}

    // возвращает название токена
    function name() public override pure returns (string memory) {
        return _name;
    }

    // возвращает символа токена
    function symbol() public override pure returns (string memory) {
        return _symbol;
    }

    // возвращает URI токена по его id
    function tokenURI(uint256 _tokenId) public override view returns (string memory) {
        require(1 <= _tokenId && _tokenId <= tokenId,
                "ERC721: URI query for nonexistent token");
        uint256 zero = 0x30;
        return string(abi.encodePacked(baseUri, uint8(zero + _tokenId)));
    }

    // возвращает баланса аккаунта по его адресу
    function balanceOf(address _owner) external override view returns (uint256) {
        return balances[_owner];
    }

    // возвращает адрес владельца токена по его id
    function ownerOf(uint256 _tokenId) external override view returns (address) {
        return owners[_tokenId];
    }

    // функция эмиссии токенов
    function mint(address to) external ownerOnly returns (uint256) {
        require(tokenId < 5, "Too many tokens");
        tokenId += 1;
        owners[tokenId] = to;
        balances[to] += 1;
        emit Mint(to, tokenId);
        return tokenId;
    }

    function isOperator(address _owner, address _addr, uint256 _tokenId)
        private view returns (bool)
    {
        return tokenApprovals[_tokenId] == _addr
            || operatorApprovals[_owner][_addr];
    }

    // функция для установки прав оператора для одного конкретного токена
    function approve(address _spender, uint256 _tokenId) public override {
        address owner = owners[_tokenId];

        require(_spender != owner, "ERC721: approval to current owner");
        require(msg.sender == owner || isOperator(owner, msg.sender, _tokenId),
                "ERC721: approve caller is not owner nor approved for all");

        tokenApprovals[_tokenId] = _spender;
        emit Approval(owner, _spender, _tokenId);
    }

    // функция для установки прав оператора на все токены
    function setApprovalForAll(address _operator, bool _approved) public override {
        require(_operator != msg.sender, "ERC721: approve to caller");
        operatorApprovals[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    // проверка прав оператора на конкретный токен
    function getApproved(uint256 _tokenId) public override view returns (address) {
        return tokenApprovals[_tokenId];
    }

    // проверка прав оператора на все токены
    function isApprovedForAll(address _owner, address _operator) public override view returns (bool) {
        return operatorApprovals[_owner][_operator];
    }

    // функция трансфера без проверки адреса _to
    function transferFrom(address _from, address _to, uint256 _tokenId) public override {
        address owner = owners[_tokenId];

        require(owner == _from, "ERC721: from is not the owner of the tokenId");
        require(msg.sender == owner || isOperator(owner, msg.sender, _tokenId),
               "ERC721: transfer caller is not owner nor approved");

        owners[_tokenId] = _to;
        balances[_from] -= 1;
        balances[_to] += 1;
        tokenApprovals[_tokenId] = address(0);
        emit Transfer(_from, _to, _tokenId);
    }

    // функция проверки наличия необходимого интерфейса на целевом аккаунте
    function _checkOnERC721Received(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory data
    ) private returns (bool) {
        // если на целевом аккаунт длина кода больше 0 - то это контракт
        if (_to.code.length > 0) {
            // если контракт - пробуем вызвать на целевом контракте функцию onERC721Received
            try IERC721Receiver(_to).onERC721Received(msg.sender, _from, _tokenId, data) returns (bytes4 response) {
                // если функция вернула значение, равное селектору функции onERC721Received - то всё ок
                return response == IERC721Receiver.onERC721Received.selector;
            // если на целевом контракте не удалось вызвать функцию onERC721Received - возвращаем false
            } catch {
                return false;
            }
        // если не контракт - возвращаем сразу true
        } else {
            return true;
        }
    }

    // функция трансфера с проверкой, что адрес _to поддерживает интерфейс IERC721Receiver
    function safeTransferFrom(address _from, address _to, uint256 _tokenId) external override {
        transferFrom(_from, _to, _tokenId);
        require(_checkOnERC721Received(_from, _to, _tokenId, ""),
               "ERC721: transfer to non ERC721Receiver implementer");
    }

    // функция трансфера с проверкой, что адрес _to поддерживает интерфейс IERC721Receiver
    function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes memory _data) public override {
        transferFrom(_from, _to, _tokenId);
        require(_checkOnERC721Received(_from, _to, _tokenId, _data),
               "ERC721: transfer to non ERC721Receiver implementer");
    }

   // функция проверки поддерживаемых интерфейсов
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
