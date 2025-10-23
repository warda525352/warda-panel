# İhale Teklif Tutarı Hesaplama Programı

Modern ve kullanıcı dostu bir Windows masaüstü uygulaması. İhale teklifleri için maliyet hesaplaması yapar.

## Özellikler

- ✅ Malzeme, işçilik ve makine maliyeti hesaplama
- ✅ Genel giderler hesaplama
- ✅ Kar marjı hesaplama
- ✅ KDV hesaplama
- ✅ Detaylı maliyet dökümü
- ✅ Anlık hesaplama
- ✅ Modern ve şık arayüz

## Hesaplama Yöntemi

Program aşağıdaki formülleri kullanır:

1. **Direkt Maliyetler** = Malzeme + İşçilik + Makine
2. **Genel Giderler** = Direkt Maliyetler × (Genel Giderler % / 100)
3. **Toplam Maliyet** = Direkt Maliyetler + Genel Giderler
4. **Kar** = Toplam Maliyet × (Kar Marjı % / 100)
5. **Ara Toplam** = Toplam Maliyet + Kar
6. **KDV** = Ara Toplam × (KDV % / 100)
7. **Teklif Tutarı** = Ara Toplam + KDV

## Gereksinimler

- Windows 10 veya üzeri
- .NET 6.0 SDK veya Runtime

## Kurulum ve Çalıştırma

### 1. .NET 6.0 SDK'yı indirin

Eğer bilgisayarınızda .NET 6.0 yüklü değilse, şu adresten indirin:
https://dotnet.microsoft.com/download/dotnet/6.0

### 2. Projeyi çalıştırın

Komut satırını (CMD veya PowerShell) açın ve proje klasörüne gidin:

```bash
cd IhaleTeklifHesaplama
```

Ardından programı çalıştırın:

```bash
dotnet run
```

### 3. Executable (.exe) oluşturma

Programdan .exe dosyası oluşturmak için:

```bash
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

Oluşan .exe dosyası şu klasörde olacak:
```
bin/Release/net6.0-windows/win-x64/publish/IhaleTeklifHesaplama.exe
```

## Kullanım

1. **Maliyet Girdileri** bölümüne malzeme, işçilik ve makine maliyetlerini girin
2. **Yüzde Oranları** bölümüne genel giderler, kar marjı ve KDV oranlarını girin
3. Program otomatik olarak hesaplayacak veya **HESAPLA** butonuna tıklayın
4. **Hesaplama Sonuçları** bölümünde detaylı dökümü görün
5. En alttaki yeşil kutuda **TEKLİF TUTARI**nı görün

## Ekran Görüntüsü

Program şu bölümlere sahiptir:

- **Maliyet Girdileri**: Malzeme, işçilik, makine maliyetleri
- **Yüzde Oranları**: Genel giderler, kar marjı, KDV oranları
- **Hesaplama Sonuçları**: Detaylı maliyet dökümü ve teklif tutarı

## Teknik Detaylar

- **Platform**: Windows
- **Framework**: .NET 6.0
- **UI Framework**: WPF (Windows Presentation Foundation)
- **Dil**: C#

## Lisans

Bu program özgürce kullanılabilir.

## İletişim

Sorularınız için lütfen iletişime geçin.

---

**© 2025 - İhale Teklif Hesaplama Programı**
