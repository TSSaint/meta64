## TODO 

# Technical Debt

* need to remove the JS scope from each module. That is not needed. Should be easy search and replace of '.js.' to '.' mostly.

* having the 'v010' folder with js files in it is not good for source control, because that approach was designed for renaming the folder which breaks source control continuity

# New Capabilities

* Need ability to expose a URL that can send back all the JS as one single file. Having multiple files is good for development, but for proction we need to send one JS file, and also minify it eventually.