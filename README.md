# Runtipi Appstore - Merged Collection

This is a comprehensive Runtipi appstore that combines apps from two excellent community repositories, providing a wide range of self-hosted applications configured for optimal performance.

> [!WARNING]
> This is a personal repository for homelab use. While we strive for quality, we cannot guarantee support and are not responsible for any data loss caused by updates to any apps in this repository.

## 📦 Apps Included

This appstore contains **26 unique applications** from the following sources:

**Note**: We removed 5 apps (filestash, gitea, minio, nextcloud, whoami) that overlapped with the official Runtipi appstore. For those apps, please use the official versions. We kept **n8n** because our version (1.123.3) is newer than official's (1.120.4).

### From [steveiliop56/runtipi-appstore](https://github.com/steveiliop56/runtipi-appstore)

- Coder
- Dockflare
- Gluetun
- Infisical
- Ironmount
- Kan
- LLDAP
- Meshcentral
- Microbin
- Miniflux
- **n8n** (version 1.123.3 - newer than official)
- Newt
- ownCloud Infinite Scale (OCIS)
- OpenFSD
- Pocket ID
- Prometheus
- Scrutiny
- Step CA
- Termix
- Tinyauth Analytics
- Zerobyte

### From [Lancelot-Enguerrand/Runtipi-Appstore](https://github.com/Lancelot-Enguerrand/Runtipi-Appstore)

- Docuseal - Digital document signing and processing
- Gitea Runner - Runner for Gitea actions
- GLPI - Asset and IT Management Software
- Habit Trove - Gamified habit tracking
- Immich Kiosk - Slideshow for Immich

## 🚀 How to Use

> [!NOTE]
> You need a [Runtipi](https://runtipi.io) installation.

1. Log into your Runtipi dashboard
2. Go to **Settings** → **App Stores**
3. Click on **Add App Store**
4. Paste this URL: `https://github.com/rbales79/runtipi-appstore-rlab`

## 📋 Requirements

- A working Runtipi installation (v2.x or higher recommended)
- Docker and Docker Compose
- Sufficient storage space for the apps you want to install

## 🔧 Development & Testing

This repository includes:

- Automated tests via Bun
- GitHub Actions workflows for CI/CD
- Renovate bot configuration for dependency updates
- Prettier formatting

To run tests locally:

```bash
bun install
bun test
```

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

### Original Repositories

- **[steveiliop56/runtipi-appstore](https://github.com/steveiliop56/runtipi-appstore)** - Personal appstore with apps configured for optimal performance
- **[Lancelot-Enguerrand/Runtipi-Appstore](https://github.com/Lancelot-Enguerrand/Runtipi-Appstore)** - Carefully curated and tested appstore

### Special Thanks

- **Runtipi Team** - [@nicotsx](https://github.com/nicotsx) and [@steveiliop56](https://github.com/steveiliop56) for creating and maintaining Runtipi
- **App Developers** - Thanks to all the developers of the open-source applications included in this appstore
- **Community Contributors** - Everyone who has contributed to the original repositories

## ⚠️ Disclaimer

This is a merged repository combining apps from multiple sources. Each app maintains its original license and credits. This repository is for personal and homelab use. Please refer to individual app licenses for commercial use restrictions.

## 🔗 Related Projects

- [Official Runtipi Appstore](https://github.com/runtipi/runtipi-appstore)
- [Runtipi Core](https://github.com/runtipi/runtipi)

## 📞 Support

For issues related to:

- **Specific apps from steveiliop56's repo**: Check [steveiliop56/runtipi-appstore](https://github.com/steveiliop56/runtipi-appstore)
- **Specific apps from Lancelot's repo**: Check [Lancelot-Enguerrand/Runtipi-Appstore](https://github.com/Lancelot-Enguerrand/Runtipi-Appstore)
- **Runtipi platform**: Check [Runtipi Discord](https://discord.gg/runtipi) or [GitHub](https://github.com/runtipi/runtipi)
- **This merged repository**: Open an issue in this repository

---

Made with ❤️ for the homelab community

