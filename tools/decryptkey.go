package main

import (
  "fmt"
  "io/ioutil"
  "crypto/rand"
  "crypto/rsa"
  "crypto/sha256"
  "crypto/x509"
  "encoding/pem"
  "encoding/base64"
  "flag"
  "log"
)

var (
    keyFile = flag.String("key", "id_rsa", "Path to RSA private key (Required)")
    label   = flag.String("label", "", "Label to use (Required)")
    message = flag.String("message", "", "Message to decrypt (Required)")
)


func main() {
  flag.Parse()

  pemData, err := ioutil.ReadFile(*keyFile)
  if err != nil {
    log.Fatalf("read key file: %s", err)
  }

  pemblock, _ := pem.Decode(pemData)
  key, err := x509.ParsePKCS1PrivateKey(pemblock.Bytes)
  if err != nil {
      log.Fatalf("bad private key: %s", err)
  }

  //pinToken := "WPdPdXnIM1OIGnELd1XnAFXec6WQJC4QtN0jZaWVBTQXk9okH9UfOzxfCdA2lGzZik3VeFC6TPqyiCM61JRSqt/uSbCzPWm7+2Svb56YRCK8jmmH7Fpy33F4grZfYx7r8AxY8Nm9A8xv+tSh2sSaUZGK0W4lFKnA/WEKkIwkzEM=";
  token, _ := base64.StdEncoding.DecodeString(*message)
  keyBytes, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, key, token, []byte(*label))
  if err != nil {
      log.Fatalf("DecryptOAEP: %s", err)
  }
  base64_str := base64.StdEncoding.EncodeToString(keyBytes)
  fmt.Println("AES key:");
  fmt.Println(base64_str)

}

