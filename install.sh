#!/bin/sh
#
# VideoKit CLI için genel yükleyici betiği (Linux & macOS)
#
# Kullanım:
# curl -fsSL https://URL_TO_THIS_SCRIPT/install.sh | sh
#

set -e

# Değişkenler (Projenize göre güncelleyin)
VK_VERSION="v1.0.0"
REPO_URL="https://github.com/YourOrg/VideoKit" # Proje reposu
INSTALL_DIR="/usr/local/bin"

# Hedef platformu ve mimariyi belirle
get_platform() {
  platform=""
  case "$(uname -s)" in
    Linux*)   platform=linux;;
    Darwin*)  platform=macos;;
    *)        echo "Hata: Desteklenmeyen işletim sistemi: $(uname -s)"; exit 1;;
  esac

  arch=""
  case "$(uname -m)" in
    x86_64)   arch=amd64;;
    arm64)    arch=arm64;;
    aarch64)  arch=arm64;;
    *)        echo "Hata: Desteklenmeyen mimari: $(uname -m)"; exit 1;;
  esac
  
  echo "${platform}-${arch}"
}

# Kurulum adımları
main() {
  PLATFORM=$(get_platform)
  DOWNLOAD_URL="${REPO_URL}/releases/download/${VK_VERSION}/videokit-cli-${PLATFORM}.tar.gz"
  
  echo "VideoKit CLI ${VK_VERSION} indiriliyor..."
  
  # Geçici bir dizin oluştur
  TMP_DIR=$(mktemp -d)
  # Betik bittiğinde veya hata verdiğinde geçici dizini sil
  trap 'rm -rf -- "$TMP_DIR"' EXIT
  
  cd "$TMP_DIR"
  
  # tar.gz dosyasını indir
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o videokit.tar.gz
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$DOWNLOAD_URL" > videokit.tar.gz
  else
    echo "Hata: Bu yükleyici için 'curl' veya 'wget' gereklidir."
    exit 1
  fi
  
  # Arşivi aç
  tar -xzf videokit.tar.gz
  
  # 'vk' çalıştırılabilir dosyasını yükle
  echo "VideoKit CLI, ${INSTALL_DIR} dizinine yükleniyor..."
  if [ -w "$INSTALL_DIR" ]; then
    # Yazma izni varsa sudo kullanma
    mv vk "${INSTALL_DIR}/"
  else
    # Yazma izni yoksa sudo kullan
    echo "Yükleme için yönetici parolası istenebilir."
    sudo mv vk "${INSTALL_DIR}/"
  fi
  
  echo ""
  echo "✅ VideoKit CLI başarıyla yüklendi!"
  echo "Kullanmaya başlamak için 'vk --help' komutunu çalıştırın."
}

# Betiği çalıştır
main