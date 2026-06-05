FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

COPY ["OpenMU_Web.csproj", "./"]
RUN dotnet restore "OpenMU_Web.csproj"

COPY . .
RUN dotnet publish "OpenMU_Web.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app

# tzdata so the TZ env var resolves real zones (e.g. Europe/Warsaw); icu-libs for
# full globalization, matching the previous Ubuntu image's behaviour.
RUN apk add --no-cache tzdata icu-libs
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

COPY --from=build /app/publish .

USER app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["dotnet", "OpenMU_Web.dll"]
