# HashiCorp Vault

HashiCorp Vault is an identity-based secrets and encryption management system. A secret is anything that you want to tightly control access to, such as API encryption keys, passwords, or certificates. Vault provides encryption services that are gated by authentication and authorization methods.

## Features

- **Secure Secret Storage**: Arbitrary key/value secrets can be stored in Vault
- **Dynamic Secrets**: Vault can generate secrets on-demand for some systems
- **Data Encryption**: Vault can encrypt and decrypt data without storing it
- **Leasing and Renewal**: All secrets in Vault have a lease associated with them
- **Revocation**: Vault has built-in support for secret revocation

## Initial Setup

1. Access Vault at `http://your-server:8200`
2. Initialize Vault on first run - you'll receive unseal keys and root token
3. Unseal Vault using 3 of the 5 unseal keys provided during initialization
4. Login with the root token
5. Configure authentication methods and policies

**Important**: Save your unseal keys and root token securely! You'll need the unseal keys every time Vault restarts.

## Unsealing Vault

After container restarts, Vault will be sealed. You must unseal it:

- Navigate to the web UI
- Enter 3 of your 5 unseal keys
- Or use the CLI: `vault operator unseal`

## Documentation

For more information, visit the [official Vault documentation](https://developer.hashicorp.com/vault/docs).
