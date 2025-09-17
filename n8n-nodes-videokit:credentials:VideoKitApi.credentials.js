/**
 * Bu dosya, n8n'in VideoKit API'sine nasıl bağlanacağını tanımlar.
 * Kullanıcı arayüzünde bir "Credential" oluşturma formu yaratır.
 */
class VideoKitApi {
    // n8n tarafından kullanılacak benzersiz kimlik
    name = 'videoKitApi';

    // Kullanıcı arayüzünde görünecek başlık
    displayName = 'VideoKit API';

    // Kullanılacak kimlik doğrulama yöntemi (hiçbiri)
    documentationUrl = 'https://github.com/videokit/videokit-platform';

    // Form alanları
    properties = [
        {
            displayName: 'API Sunucu URL',
            name: 'apiUrl',
            type: 'string',
            default: 'http://localhost:3000',
            placeholder: 'http://localhost:3000',
            description: 'VideoKit API sunucunuzun tam adresi.',
            required: true,
        },
    ];
}

module.exports = { VideoKitApi };