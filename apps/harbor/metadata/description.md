# Harbor

Harbor is an open source registry that secures artifacts with policies and role-based access control, ensures images are scanned and free from vulnerabilities, and signs images as trusted. Harbor, a CNCF Graduated project, delivers compliance, performance, and interoperability to help you consistently and securely manage artifacts across cloud native compute platforms like Kubernetes and Docker.

## Features

- **Security and vulnerability analysis**: Harbor scans images for vulnerabilities
- **Content signing and validation**: Harbor signs images to ensure they haven't been tampered with
- **Multi-tenancy**: Projects in Harbor provide a way to isolate repositories and images
- **Extensible API and web UI**: Harbor provides comprehensive APIs and a user-friendly web interface
- **Replication**: Harbor can replicate images between multiple registries
- **Identity integration**: Harbor integrates with existing enterprise identity systems

## Initial Setup

1. Access Harbor at `http://your-server:8888`
2. Login with username `admin` and the password you configured
3. Create projects and configure repositories
4. Configure Docker/Podman to use your Harbor registry

## Usage

To push images to Harbor:

```bash
docker login your-server:8888
docker tag myimage:latest your-server:8888/myproject/myimage:latest
docker push your-server:8888/myproject/myimage:latest
```

## Documentation

For more information, visit the [official Harbor documentation](https://goharbor.io/docs/).
