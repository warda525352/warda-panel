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
            // İlk açılışta hesaplamayı yap
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

                // Sonuçları göster
                lblDirektMaliyet.Content = FormatCurrency(direktMaliyetler);
                lblGenelGiderlerTutar.Content = FormatCurrency(genelGiderlerTutar);
                lblToplamMaliyet.Content = FormatCurrency(toplamMaliyet);
                lblKarTutar.Content = FormatCurrency(karTutar);
                lblAraToplam.Content = FormatCurrency(araToplam);
                lblKDVTutar.Content = FormatCurrency(kdvTutar);
                lblTeklifTutari.Content = FormatCurrency(teklifTutari);
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
