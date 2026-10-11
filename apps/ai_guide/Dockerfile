FROM nginx:alpine

# AI 실생활 활용 실전 가이드 정적 파일 배포
# 루트(/) 및 서브패스(/ai_guide/) 모두 접속 가능하도록 구성
COPY . /usr/share/nginx/html/
RUN mkdir -p /usr/share/nginx/html/ai_guide && cp -r /usr/share/nginx/html/*.html /usr/share/nginx/html/ai_guide/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
