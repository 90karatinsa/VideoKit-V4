/**
 * VideoKit n8n Düğümü
 * Bu dosya, düğümün kullanıcı arayüzü tanımını ve ana yürütme mantığını içerir.
 */
class VideoKit {
    description = {
        displayName: 'VideoKit',
        name: 'videoKit',
        icon: 'file:VideoKit.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'VideoKit C2PA Doğrulama ve Manifest Oluşturma Aracı',
        defaults: {
            name: 'VideoKit',
        },
        // Girdi ve Çıktı Tanımları
        inputs: ['main'],
        outputs: ['main'],
        // Kimlik Bilgileri
        credentials: [
            {
                name: 'videoKitApi',
                required: true,
            },
        ],
        // Düğümün Arayüz Alanları
        properties: [
            {
                displayName: 'Operasyon',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Doğrula (Verify)',
                        value: 'verify',
                        description: 'Bir video dosyasının C2PA manifestini doğrular',
                        action: 'Bir video dosyasını doğrula',
                    },
                    {
                        name: 'Manifest Oluştur (Stamp)',
                        value: 'stamp',
                        description: 'Bir video için .c2pa yan dosyası oluşturur',
                        action: 'Bir video için manifest oluştur',
                    },
                ],
                default: 'verify',
            },

            // --- Doğrulama (Verify) Operasyonu Alanları ---
            // Bu alanlar 'operation' 'verify' olduğunda görünür.
            // n8n, gelen verideki binary property'nin adını bilmek zorundadır.
            // Genellikle 'data' kullanılır.
            {
                displayName: 'Binary Veri Alanı',
                name: 'binaryPropertyName',
                type: 'string',
                default: 'data',
                required: true,
                displayOptions: {
                    show: {
                        operation: ['verify', 'stamp'],
                    },
                },
                description: 'Gelen veride dosya içeriğini barındıran alanın adı.',
            },

            // --- Manifest Oluşturma (Stamp) Operasyonu Alanları ---
            // Bu alanlar 'operation' 'stamp' olduğunda görünür.
            {
                displayName: 'Yazar (Creator)',
                name: 'author',
                type: 'string',
                default: '',
                required: true,
                displayOptions: {
                    show: {
                        operation: ['stamp'],
                    },
                },
                placeholder: 'Örn: VideoKit Departmanı',
                description: 'Manifeste eklenecek yazar (creator) bilgisi.',
            },
        ],
    };

    /**
     * Düğümün ana yürütme fonksiyonu.
     * @param {import('n8n-workflow').IExecuteFunctions} this
     * @returns {Promise<import('n8n-workflow').INodeExecutionData[][]>}
     */
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const operation = this.getNodeParameter('operation', 0);
        const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0);

        // API kimlik bilgilerini al
        const credentials = await this.getCredentials('videoKitApi');
        const apiUrl = credentials.apiUrl.endsWith('/') ? credentials.apiUrl.slice(0, -1) : credentials.apiUrl;

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const item = items[itemIndex];
                const binaryData = item.binary?.[binaryPropertyName];

                if (!binaryData) {
                    throw new Error(`Gelen veride binary alan ('${binaryPropertyName}') bulunamadı.`);
                }
                const fileName = binaryData.fileName || 'video.mp4';
                
                // --- OPERASYON: DOĞRULA (VERIFY) ---
                if (operation === 'verify') {
                    const formData = {
                        file: {
                            value: Buffer.from(binaryData.data, 'base64'),
                            options: { filename: fileName },
                        },
                    };
                    const options = {
                        method: 'POST',
                        uri: `${apiUrl}/verify`,
                        formData,
                        json: true,
                    };

                    const firstResponse = await this.helpers.request(options);
                    const jobId = firstResponse.jobId;

                    if (!jobId) {
                        throw new Error('API yanıtından geçerli bir Job ID alınamadı.');
                    }
                    
                    // İş sonucunu almak için yoklama (polling)
                    let jobResult = null;
                    const maxAttempts = 20; // Maksimum deneme (20 * 2sn = 40sn timeout)
                    for (let i = 0; i < maxAttempts; i++) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
                        const jobStatusResponse = await this.helpers.request({
                            uri: `${apiUrl}/jobs/${jobId}`,
                            json: true,
                        });

                        if (jobStatusResponse.state === 'completed') {
                            jobResult = jobStatusResponse.result;
                            break;
                        } else if (jobStatusResponse.state === 'failed') {
                            throw new Error(`Doğrulama işi başarısız oldu: ${jobStatusResponse.error}`);
                        }
                    }

                    if (!jobResult) {
                        throw new Error('İş zaman aşımına uğradı.');
                    }
                    
                    returnData.push({ json: jobResult, pairedItem: { item: itemIndex } });
                }

                // --- OPERASYON: MANIFEST OLUŞTUR (STAMP) ---
                if (operation === 'stamp') {
                    const author = this.getNodeParameter('author', itemIndex);
                    const formData = {
                        file: {
                            value: Buffer.from(binaryData.data, 'base64'),
                            options: { filename: fileName },
                        },
                        author: author,
                    };
                    
                    const options = {
                        method: 'POST',
                        uri: `${apiUrl}/stamp`,
                        formData,
                        encoding: null, // Binary yanıt beklediğimizi belirtir
                    };

                    const responseBuffer = await this.helpers.request(options);
                    const newFileName = (fileName.split('.').slice(0, -1).join('.') || 'manifest') + '.c2pa';
                    const newBinaryData = await this.helpers.prepareBinaryData(responseBuffer, newFileName, 'application/c2pa');
                    
                    returnData.push({ 
                        json: item.json, 
                        binary: { [binaryPropertyName]: newBinaryData },
                        pairedItem: { item: itemIndex }
                    });
                }
            } catch (error) {
                if (this.continueOnFail()) {
                    items[itemIndex].json.error = error.message;
                    returnData.push(items[itemIndex]);
                    continue;
                }
                throw error;
            }
        }
        return [this.helpers.returnJsonArray(returnData)];
    }
}

module.exports = { VideoKit };