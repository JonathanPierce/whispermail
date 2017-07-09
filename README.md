# WhisperMail
An easy to use, decentralized, end-to-end encrypted email analogue based on the Signal Protocol.

## Design
- Client and server both encrypt data at rest, secured via a password.
- Server only retains messages until retreived, and stored minimal metadata in plaintext.
- Clients authenticate to the server by signing challenges from the server.
- Signal protocol is used to end-to-end encrypt messages.
- Signal protocol provides greater ease-of-use than PGP, along with greater security.

## TODO

- Make sure messages delete properly on server
- Finish any in-code TODOs (deleting, deregistering, etc...)
- Change message schema to be email-only for recipient/sender?
- Initial cross-server local testing
- HTTPS support (while keeping local dev) - self-signed certs for dev?
- Rudimentary UI for sending/receiving
- Improve error handling (eg: one recipient fails out of 10)
- Invite codes
- Document server config
- Add IP whitelist/blacklist to server
- Improved login UI / start using SCSS
- Improved server request validation
- Figure out server logging
- Build the full UI
- Database import/export
