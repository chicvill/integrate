import psycopg2
try:
    conn = psycopg2.connect("postgresql://postgres.txdpdcarkeecejmsyklu:minkim5053supabase@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres")
    print('SUCCESS')
    conn.close()
except Exception as e:
    print('ERROR:', e)
