#!/usr/bin/env python

import argparse
import logging
from pprint import pprint

from pyepm import api
from pyethereum import abi
import serpent

CONTRACT_FILE = "contracts/sleth.se"
CONTRACT_GAS = 55000

ETHER = 10 ** 18

def load_abi_translator():
    serpent_code = open(CONTRACT_FILE).read()
    return abi.ContractTranslator(serpent.mk_full_signature(serpent_code))

CONTRACT_TRANSLATOR = load_abi_translator()

def abi_call(instance, contract, translator, fun_name, args):
    data = translator.encode(fun_name, args).encode('hex')
    result = instance.call(contract, data=data)
    output = translator.decode(fun_name, result[2:].decode('hex'))
    return output[0]

def abi_transact(instance, contract, translator, fun_name, args, value=0):
    data = translator.encode(fun_name, args).encode('hex')
    result = instance.transact(contract, data=data, value=value)
    return

def cmd_spin(args):
    print "Spinning the slots with bet", args.bet
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    abi_transact(instance, args.contract, CONTRACT_TRANSLATOR, 'spin', [int(args.bet)], value=int(args.bet) * ETHER)

def cmd_claim(args):
    print "Claiming round ", args.round
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    abi_transact(instance, args.contract, CONTRACT_TRANSLATOR, 'claim', [int(args.round)])

def cmd_get_round(args):
    print "Getting information about round", args.round
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = abi_call(instance, args.contract, CONTRACT_TRANSLATOR, 'get_round', [int(args.round)])
    player, block, timestamp, bet, result, entropy, rnd, status = result
    print "Player:", hex(player)
    print "Block:", block
    print "Timestamp:", timestamp
    print "Bet:", bet
    print "Result:", result
    print "Entropy:", hex(entropy)
    print "RND:", rnd
    print "Status:", status

def cmd_get_current_round(args):
    print "Getting information about the current player round"
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = abi_call(instance, args.contract, CONTRACT_TRANSLATOR, 'get_current_round', [])
    print "Current round:", result

def cmd_get_stats(args):
    print "Getting statistics"
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    result = abi_call(instance, args.contract, CONTRACT_TRANSLATOR, 'get_stats', [])
    current_round, total_spins, total_coins_won = result
    print "Current round:", current_round
    print "Total spins:", total_spins
    print "Total coins won:", total_coins_won

def cmd_suicide(args):
    print "Killing the contract"
    instance = api.Api()
    assert instance.is_contract_at(args.contract), "Contract not found"
    abi_transact(instance, args.contract, CONTRACT_TRANSLATOR, 'suicide', data=[])

def cmd_create(args):
    instance = api.Api()
    creator_address = instance.accounts()[0]
    creator_balance = instance.balance_at(creator_address)
    if creator_balance < CONTRACT_GAS * 1e+13:
        print "Insufficient balance to cover gas for contract creation."
        print "You need at least %d wei in account %s (current balance is %d wei)." % \
            (CONTRACT_GAS * 1e+13, creator_address, creator_balance)
        return
    contract = compile(open(CONTRACT_FILE).read()).encode('hex')
    contract_address = instance.create(contract, gas=CONTRACT_GAS)
    print "Contract will be available at %s" % contract_address
    if args.wait:
        instance.wait_for_next_block(verbose=True)
    print "Is contract?", instance.is_contract_at(contract_address)

def cmd_inspect(args):
    instance = api.Api()
    result = instance.is_contract_at(args.contract)
    print "Is contract?", result

    result = instance.balance_at(args.contract)
    print "Balance", result

    result = instance.storage_at(args.contract)
    pprint(result)

def cmd_status(args):
    instance = api.Api()

    print "Coinbase: %s" % instance.coinbase()
    print "Listening? %s" % instance.is_listening()
    print "Mining? %s" % instance.is_mining()
    print "Peer count: %d" % instance.peer_count()
    print "Number: %d" % instance.number()

    last_block = instance.last_block()
    print "Last Block:"
    pprint(last_block)

    accounts = instance.accounts()
    print "Accounts:"
    for address in accounts:
        balance = instance.balance_at(address)
        print "- %s %.4e" % (address, balance)

def cmd_transact(args):
    instance = api.Api()

    instance.transact(args.dest, value=args.value * ETHER)
    if args.wait:
        instance.wait_for_next_block(verbose=True)

def main():
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers(help='sub-command help')
    parser_create = subparsers.add_parser('create', help='create the contract')
    parser_create.set_defaults(func=cmd_create)
    parser_create.add_argument('--wait', action='store_true', help='wait for block to be mined')

    parser_inspect = subparsers.add_parser('inspect', help='inspect the contract')
    parser_inspect.set_defaults(func=cmd_inspect)
    parser_inspect.add_argument('contract', help='sleth contract address')

    parser_status = subparsers.add_parser('status', help='display the eth node status')
    parser_status.set_defaults(func=cmd_status)

    parser_transact = subparsers.add_parser('transact', help='transact ether to destination (default: 1 ETH)')
    parser_transact.set_defaults(func=cmd_transact)
    parser_transact.add_argument('dest', help='destination')
    parser_transact.add_argument('--value', type=int, default=1, help='value to transfer in ether')
    parser_transact.add_argument('--wait', action='store_true', help='wait for block to be mined')

    parser_spin = subparsers.add_parser('spin', help='make a spin')
    parser_spin.set_defaults(func=cmd_spin)
    parser_spin.add_argument('contract', help='sleth contract address')
    parser_spin.add_argument('bet', help='bet amount')

    parser_claim = subparsers.add_parser('claim', help='clain a round')
    parser_claim.set_defaults(func=cmd_claim)
    parser_claim.add_argument('contract', help='sleth contract address')
    parser_claim.add_argument('round', help='round number to claim')

    parser_get_round = subparsers.add_parser('get_round', help='get round information')
    parser_get_round.set_defaults(func=cmd_get_round)
    parser_get_round.add_argument('contract', help='sleth contract address')
    parser_get_round.add_argument('round', help='round number')

    parser_get_current_round = subparsers.add_parser('get_current_round', help='get current round')
    parser_get_current_round.set_defaults(func=cmd_get_current_round)
    parser_get_current_round.add_argument('contract', help='sleth contract address')

    parser_get_stats = subparsers.add_parser('get_stats', help='get contract statistics')
    parser_get_stats.set_defaults(func=cmd_get_stats)
    parser_get_stats.add_argument('contract', help='sleth contract address')

    parser_suicide = subparsers.add_parser('suicide', help='kills the contract')
    parser_suicide.set_defaults(func=cmd_suicide)
    parser_suicide.add_argument('contract', help='sleth contract address')

    args = parser.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
