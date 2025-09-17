# Homebrew için Formula dosyası
# Bu dosyanın bir "Tap" reposunda (örn: github.com/YourOrg/homebrew-tap)
# Formula/videokit.rb olarak bulunması gerekir.
# Kurulum:
# brew tap YourOrg/homebrew-tap
# brew install videokit
class Videokit < Formula
  desc "VideoKit İçerik Güvenilirliği Platformu CLI"
  homepage "https://github.com/YourOrg/VideoKit" # Projenizin GitHub adresiyle güncelleyin
  url "https://github.com/YourOrg/VideoKit/archive/refs/tags/v1.0.0.tar.gz" # Yayınlanmış tar.gz dosyanızın URL'i
  sha256 "81bf035e46b36a1e389c3c861f016335941c1e5b530514125997637841c30e9a" # `shasum -a 256 v1.0.0.tar.gz` komutunun çıktısı
  license "UNLICENSED"

  depends_on "node"

  def install
    # Bu komutlar, node modüllerini Homebrew'un standart `libexec` dizinine kurar
    # ve `package.json` dosyasındaki "bin" tanımına göre bir sembolik link oluşturur.
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    # `vk --version` komutunun hatasız çalışıp çalışmadığını kontrol et
    # Bu, kurulumun temel düzeyde başarılı olduğunu gösterir.
    assert_match "vk", shell_output("#{bin}/vk --help")
  end
end