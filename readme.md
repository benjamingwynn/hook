# Hook

Hook allows for easy automated deployment of production node.js applications.

## Usage

`hook [port]/[endpoint] [path] --gitlab`

This will hook port 3000 to listen on path /deploy for POST HTTP requests.

`--gitlab` specifies that this should generate and expect a secret token on the `X-Gitlab-Token` header. You can also do `--gitlab=[token]` to specify a custom header.
