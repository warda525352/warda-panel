<?php
// Önbellek engelleme başlıkları
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// Tarayıcıya cevabın JSON formatında olacağını söylüyoruz.
header('Content-Type: application/json');

// Veritabanı dosyamızın yolu.
$db_path = __DIR__ . '/database.json';

// Gelen isteğin türünü (GET mi, POST mu) kontrol ediyoruz.
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Eğer dosya mevcutsa, içeriğini oku ve tarayıcıya gönder.
    if (file_exists($db_path)) {
        echo file_get_contents($db_path);
    } else {
        // Dosya yoksa, boş bir JSON nesnesi gönder.
        echo '{}';
    }
} elseif ($method === 'POST') {
    // JavaScript'ten gelen JSON verisini al.
    $data_from_js = file_get_contents('php://input');
    
    // Gelen veriyi dosyaya yaz. JSON_PRETTY_PRINT, dosyayı daha okunaklı yapar.
    if (file_put_contents($db_path, $data_from_js) !== false) {
        // Başarılı olursa bir onay mesajı gönder.
        echo json_encode(['message' => 'Veriler başarıyla kaydedildi.']);
    } else {
        // Hata olursa, 500 durum kodu ile bir hata mesajı gönder.
        http_response_code(500);
        echo json_encode(['message' => 'Hata: Veritabanı dosyasına yazılamadı!']);
    }
}
?>