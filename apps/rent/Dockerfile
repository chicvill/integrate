FROM nginx:alpine

# 29개실 원룸 임차료 관리 시스템 정적 파일 배포
# 루트(/) 및 서브패스(/rent/) 모두 접속 가능하도록 구성
COPY . /usr/share/nginx/html/
RUN mkdir -p /usr/share/nginx/html/rent && cp -r /usr/share/nginx/html/*.html /usr/share/nginx/html/rent/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
