FROM mcr.microsoft.com/dotnet/sdk:8.0-noble AS build
WORKDIR /src

COPY ["OpenMU_Web.csproj", "./"]
RUN dotnet restore "OpenMU_Web.csproj"

COPY . .
RUN dotnet publish "OpenMU_Web.csproj" -c Release -o /app/publish

FROM ubuntu:24.04
WORKDIR /app

RUN apt-get update && apt-get install -y \
    dotnet-runtime-8.0 \
    aspnetcore-runtime-8.0 \
    tzdata \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY --from=build /app/publish .

RUN chown -R ubuntu:ubuntu /app/
USER ubuntu

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

ENTRYPOINT ["dotnet", "OpenMU_Web.dll"]
