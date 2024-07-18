<?php
define('SECRET', '');
define('USER', '');
define('PWD', '');
define('PASSKEY', '');

$action = filter_input(INPUT_GET, 'action', FILTER_UNSAFE_RAW);
$yggUrl = file_get_contents(__DIR__ . '/ygg-url.txt');
$current = (@$_SERVER['REQUEST_SCHEME'] ?? "http") . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];

switch ($action) {
  case 'rss':           rss();
  case 'get-torrent':   getTorrent();
  case 'get-ygg-url':   getYggUrl();
  case 'set-ygg-url':   setYggUrl();
  default:              send('unknown action', 'text/plain', 400);
}

/**
 * Sends a response
 * @param mixed  $data
 * @param string $type
 * @param int    $code
 */
function send(mixed $data, string $type, int $code) {
  http_response_code($code);
  header("Content-type: $type");
  echo $data;
  exit;
}

function updateCookie() {
  global $yggUrl;
  if (! file_exists(__FILE__ . '.cookies') || filemtime(__FILE__ . '.cookies') < time() - 1740) { // 29 minutes
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_CAINFO, __DIR__ . '/cacert.pem');
    curl_setopt($ch, CURLOPT_CAPATH, __DIR__ . '/cacert.pem');
    curl_setopt($ch, CURLOPT_URL, $yggUrl . '/auth/process_login');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEJAR, __FILE__ . '.cookies'); // Save cookies to this file
    curl_setopt($ch, CURLOPT_COOKIEFILE, __FILE__ . '.cookies'); // Read cookies from this file
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, ['id' => USER, 'pass' => PWD]);
    $response = curl_exec($ch);
    if ($response === false) {
      send("cURL error: " . curl_error($ch), 'text/plain', 500);
    }
    curl_close($ch);
  }
}

/**
 * Retrieves the RSS feed and filters it
 * http://localhost:8000/index_ICcmh6HFo6aPqOW40.php?action=rss
 */
function rss() {
  global $yggUrl;
  global $current;
  updateCookie();

  $ch = curl_init();
  curl_setopt($ch, CURLOPT_CAINFO, __DIR__ . '/cacert.pem');
  curl_setopt($ch, CURLOPT_CAPATH, __DIR__ . '/cacert.pem');
  curl_setopt($ch, CURLOPT_URL, $yggUrl . "/rss?action=generate&type=cat&id=2145&passkey=" . PASSKEY);
  curl_setopt($ch, CURLOPT_COOKIEJAR, __FILE__ . '.cookies');
  curl_setopt($ch, CURLOPT_COOKIEFILE, __FILE__ . '.cookies');
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $response = curl_exec($ch);
  if ($response === false) {
    send("cURL error: " . curl_error($ch), 'text/plain', 500);
  }
  curl_close($ch);
  send(str_replace($yggUrl . '/rss/download?', $current . '?action=get-torrent&amp;', $response), 'text/plain', 200);
}

/**
 * download torrent file
 * http://localhost:8000/index_ICcmh6HFo6aPqOW40.php?action=get-torrent&id=123
 */
function getTorrent() {
  global $yggUrl;
  $id = filter_input(INPUT_GET, 'id', FILTER_UNSAFE_RAW);
  updateCookie();

  $ch = curl_init();
  curl_setopt($ch, CURLOPT_CAINFO, __DIR__ . '/cacert.pem');
  curl_setopt($ch, CURLOPT_CAPATH, __DIR__ . '/cacert.pem');
  curl_setopt($ch, CURLOPT_URL, $yggUrl . "/rss/download?id=" . $id . "&passkey=" . PASSKEY);
  curl_setopt($ch, CURLOPT_COOKIEJAR, __FILE__ . '.cookies');
  curl_setopt($ch, CURLOPT_COOKIEFILE, __FILE__ . '.cookies');
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $response = curl_exec($ch);
  if ($response === false) {
    send("cURL error: " . curl_error($ch), 'text/plain', 500);
  }
  curl_close($ch);
  send($response, 'application/x-bittorrent', 200);
}

/**
 * Sets the Ygg URL
 * http://localhost:8000/index_ICcmh6HFo6aPqOW40.php?action=get-ygg-url
 */
function getYggUrl() {
  send(file_get_contents(__DIR__ . '/ygg-url.txt'), 'text/plain', 200);
}

/**
 * Sets the Ygg URL
 * http://localhost:8000/index_ICcmh6HFo6aPqOW40.php?action=set-ygg-url&url=https%3A%2F%2Fwww3.yggtorrent.qa
 */
function setYggUrl() {
  $yggUrl = filter_input(INPUT_GET, 'url', FILTER_UNSAFE_RAW);
  if ($yggUrl) {
    file_put_contents(__DIR__ . '/ygg-url.txt', $yggUrl);
  }
  send(file_get_contents(__DIR__ . '/ygg-url.txt'), 'text/plain', 200);
}
