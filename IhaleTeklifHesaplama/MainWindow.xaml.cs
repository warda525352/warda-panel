using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;

namespace IhaleTeklifHesaplama
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            // Pencere yüklendikten sonra hesaplama yapılacak
            this.Loaded += MainWindow_Loaded;
        }

        // Pencere yüklendikten sonra ilk hesaplamayı yap
        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            TeklifHesapla();
        }

        // Hesapla butonuna tıklandığında
        private void BtnHesapla_Click(object sender, RoutedEventArgs e)
        {
            TeklifHesapla();
        }

        // TextBox değiştiğinde otomatik hesaplama
        private void HesaplamaGuncelle(object sender, TextChangedEventArgs e)
        {
            TeklifHesapla();
        }

        // Ana hesaplama fonksiyonu
        private void TeklifHesapla()
        {
            try
            {
                // Kontroller henüz yüklenmediyse çık
                if (txtMalzemeMaliyet == null || txtIscilikMaliyet == null ||
                    txtMakineMaliyet == null || txtGenelGiderler == null ||
                    txtKarMarji == null || txtKDV == null)
                    return;

                // Giriş değerlerini al ve kontrol et
                decimal malzemeMaliyet = ParseDecimal(txtMalzemeMaliyet.Text);
                decimal iscilikMaliyet = ParseDecimal(txtIscilikMaliyet.Text);
                decimal makineMaliyet = ParseDecimal(txtMakineMaliyet.Text);

                decimal genelGiderlerYuzde = ParseDecimal(txtGenelGiderler.Text);
                decimal karMarjiYuzde = ParseDecimal(txtKarMarji.Text);
                decimal kdvYuzde = ParseDecimal(txtKDV.Text);

                // 1. Direkt Maliyetler
                decimal direktMaliyetler = malzemeMaliyet + iscilikMaliyet + makineMaliyet;

                // 2. Genel Giderler
                decimal genelGiderlerTutar = direktMaliyetler * (genelGiderlerYuzde / 100);

                // 3. Toplam Maliyet
                decimal toplamMaliyet = direktMaliyetler + genelGiderlerTutar;

                // 4. Kar
                decimal karTutar = toplamMaliyet * (karMarjiYuzde / 100);

                // 5. Ara Toplam (KDV Hariç)
                decimal araToplam = toplamMaliyet + karTutar;

                // 6. KDV
                decimal kdvTutar = araToplam * (kdvYuzde / 100);

                // 7. Teklif Tutarı (KDV Dahil)
                decimal teklifTutari = araToplam + kdvTutar;

                // Sonuçları göster (Label'lar da yüklendiyse)
                if (lblDirektMaliyet != null) lblDirektMaliyet.Content = FormatCurrency(direktMaliyetler);
                if (lblGenelGiderlerTutar != null) lblGenelGiderlerTutar.Content = FormatCurrency(genelGiderlerTutar);
                if (lblToplamMaliyet != null) lblToplamMaliyet.Content = FormatCurrency(toplamMaliyet);
                if (lblKarTutar != null) lblKarTutar.Content = FormatCurrency(karTutar);
                if (lblAraToplam != null) lblAraToplam.Content = FormatCurrency(araToplam);
                if (lblKDVTutar != null) lblKDVTutar.Content = FormatCurrency(kdvTutar);
                if (lblTeklifTutari != null) lblTeklifTutari.Content = FormatCurrency(teklifTutari);
            }
            catch (Exception ex)
            {
                // Hata durumunda kullanıcıya bilgi ver
                MessageBox.Show(
                    "Lütfen geçerli sayısal değerler girin.\n\nHata: " + ex.Message,
                    "Hata",
                    MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        // Metni decimal'e çevir
        private decimal ParseDecimal(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return 0;

            // Türkçe virgül ve nokta desteği
            text = text.Replace(',', '.');

            if (decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal result))
                return result;

            return 0;
        }

        // Para formatında göster
        private string FormatCurrency(decimal amount)
        {
            return amount.ToString("N2", new CultureInfo("tr-TR")) + " TL";
        }
    }
}
