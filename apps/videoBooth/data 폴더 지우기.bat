@echo off
REM 'data' 폴더 안의 모든 파일 삭제 (/q는 묻지 않음, /f는 읽기 전용도 삭제)
del /q /f "data\*.*"

REM 만약 'data' 폴더 안의 하위 폴더들까지 모두 비우고 싶다면 아래 줄의 주석을 해제하세요.
REM for /d %%x in ("data\*") do rd /s /q "%%x"

echo data 폴더 내의 모든 파일이 삭제되었습니다.
pause