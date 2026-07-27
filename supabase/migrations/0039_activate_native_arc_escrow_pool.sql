-- Switch LOOMON demo checkout from ERC-20 approve/transferFrom pool to a
-- native Arc USDC payable pool. Buyers now sign one Place order transaction.

update payments.contract_versions
set status = 'retired'
where chain_id = 5042002
  and contract_name = 'LoomonEscrowPool'
  and status = 'active';

insert into payments.contract_versions(
  chain_id,
  contract_name,
  version,
  implementation_address,
  bytecode_hash,
  deployment_tx_hash,
  deployment_block,
  status,
  activated_at
)
values (
  5042002,
  'LoomonEscrowPool',
  '1.1.0-native-usdc',
  '0x95d242919da239859ca7ab8eddc77ae5b4f450db',
  '0x5c8bfa98f6f6eccad69dc4d86ad53e68367b56f1e9dfc37556bbd96405165eeb',
  '0x1e68c6f230ff31a59fcea42b2d019e51deade0cd05dfd0a2e5e2272fc9e6f2b3',
  53914663,
  'active',
  now()
)
on conflict (chain_id, contract_name, version) do update
set
  implementation_address = excluded.implementation_address,
  bytecode_hash = excluded.bytecode_hash,
  deployment_tx_hash = excluded.deployment_tx_hash,
  deployment_block = excluded.deployment_block,
  status = excluded.status,
  activated_at = excluded.activated_at;
