; SPDX-License-Identifier: MIT
; X Messenger NSIS per-user installer (no admin). Expects the portable
; staging dir as $%BUILD_DIR% (see scripts/build-windows.sh).
!include "MUI2.nsh"
Name "X Messenger ${VERSION}"
OutFile "X-Messenger-${VERSION}-Windows-${ARCH}-setup.exe"
InstallDir "$LOCALAPPDATA\x-messenger"
RequestExecutionLevel user
ShowInstDetails show

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${BUILD_DIR}\*.*"
  CreateDirectory "$SMPROGRAMS\X Messenger"
  CreateShortcut "$SMPROGRAMS\X Messenger\X Messenger.lnk" "$INSTDIR\x-messenger.cmd" "gui" "$INSTDIR\app\assets\icon.ico"
  CreateShortcut "$DESKTOP\X Messenger.lnk" "$INSTDIR\x-messenger.cmd" "gui" "$INSTDIR\app\assets\icon.ico"
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\X Messenger\X Messenger.lnk"
  Delete "$DESKTOP\X Messenger.lnk"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR"
SectionEnd
