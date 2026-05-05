# openmu-simple-web
This is simple website for OpenMU. 

Website has been created for mine OpenMU server builder: https://github.com/nolt/openmu-docker
It connects to same docker network where database is.

Website is multilanguage English and Polish.

Website allows:
- register new account
- change password

Future plans:
- list characters with all details (resets, stats)

## Requirements
- Docker
- Docker Compose

## Building
- clone this repository
- replace values in .env to your own
- build
---
Build your service:

```docker compose up -d --build```

Images:

![Main page](assets/mainreg.jpg)

![Change pass](assets/resetpass.jpg)

---



More info about OpenMU project you will find here:
https://github.com/MUnique/OpenMU

