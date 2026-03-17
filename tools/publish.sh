#!/usr/bin/env bash -eu

for package in actions-setup-cage actions-deploy-cage actions-audit-cage; do
  npm publish "./build/@loilo-inc/${package}" $@
done
