#!/bin/bash
./setenv.sh


#
# Trouble with Tidy: check for "- -" where "--" was needed.
#

export timestamp=`eval date +%Y-%m-%d-%s`
export backupFolder=/ferguson/meta64Oak-private/auto-bak

#todo this tidy stuff should be wrapped in a callable script for DRY.

./run-tidy.sh /ferguson/meta64Oak/src/main/resources/templates index
./run-tidy.sh /ferguson/meta64Oak/src/main/resources/public/elements/main-tabs main-tabs
./run-tidy.sh /ferguson/meta64Oak/src/main/resources/public/elements/donate-panel donate-panel

#copy the readme.md from project root to published location (landing-page.md) where the app will 
#be able to pick it up at runtime.
cp /ferguson/meta64Oak/readme.md /ferguson/meta64Oak/src/main/resources/static/landing-page.md

#go back to folder with this script in it. sort of 'home' for this script
cd /ferguson/meta64Oak/build

cat ../src/main/resources/public/js/meta64/cnst.js > all.js
cat ../src/main/resources/public/js/meta64/util.js >> all.js
cat ../src/main/resources/public/js/meta64/jcrCnst.js >> all.js
cat ../src/main/resources/public/js/meta64/attachment.js >> all.js
cat ../src/main/resources/public/js/meta64/edit.js >> all.js
cat ../src/main/resources/public/js/meta64/meta64.js >> all.js
cat ../src/main/resources/public/js/meta64/nav.js >> all.js
cat ../src/main/resources/public/js/meta64/prefs.js >> all.js
cat ../src/main/resources/public/js/meta64/props.js >> all.js
cat ../src/main/resources/public/js/meta64/render.js >> all.js
cat ../src/main/resources/public/js/meta64/search.js >> all.js
cat ../src/main/resources/public/js/meta64/share.js >> all.js
cat ../src/main/resources/public/js/meta64/user.js >> all.js
cat ../src/main/resources/public/js/meta64/view.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/base/Dialog.js >> all.js
cat ../src/main/resources/public/js/meta64/menu/menuPanel.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/ConfirmDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/DonateDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/MessageDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/LoginDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/SignupDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/PrefsDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/ExportDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/ImportDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/SearchDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/ChangePasswordDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/UploadDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/EditNodeDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/EditPropertyDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/ShareToPersonDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/SharingDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/dlg/RenameNodeDlg.js >> all.js
cat ../src/main/resources/public/js/meta64/panel/searchResultsPanel.js >> all.js
cat ../src/main/resources/public/js/meta64/panel/timelineResultsPanel.js  >> all.js


#java -jar google-compiler.jar --js_output_file="../src/main/resources/public/js/meta64.min.js" "../src/main/resources/public/js/meta64/**.js"
java -jar google-compiler.jar --js_output_file="../src/main/resources/public/js/meta64.min.js" all.js
 
#java -jar google-compiler.jar --help
read -p "Google compiler done."

cd /ferguson/meta64Oak
ant -buildfile build.xml all

mvn dependency:sources
mvn dependency:resolve -Dclassifier=javadoc
mvn clean package -DskipTests=true

cp -v ./target/com.meta64.mobile-0.0.1-SNAPSHOT.jar /run-root/com.meta64.mobile-0.0.1-SNAPSHOT.jar

@echo Cleaning up...
del /ferguson/meta64Oak/build/all.js
del /ferguson/meta64Oak/src/main/resources/public/js/meta64.min.js

read -p "All done."


