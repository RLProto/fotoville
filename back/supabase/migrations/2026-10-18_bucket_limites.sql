-- Bucket das fotos: até 50 MB por arquivo e só JPG, PNG e WebP, o mesmo que o site aceita.
-- O tamanho que o navegador declara não entra na URL assinada do envio; este limite vale para o arquivo de verdade.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'fotoville-fotos';
