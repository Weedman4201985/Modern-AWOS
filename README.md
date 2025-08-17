# 🛰️ Modern AWOS Weather Station Interface

A real-time weather dashboard for CYTR (Trenton Airport), built with Node.js and PowerShell. This project parses AWOS XML feeds and METAR/TAF reports, displaying live aviation-grade weather data in a sleek, dark-mode-enabled interface.

  
## 🌟 Features


- 🌐 **Live AWOS Data**: Real-time updates from CYTR
  
- 📄 **METAR/TAF Viewer**: Displays official aviation weather reports
  
- 🧾 **Raw XML Parsing**: Full AWOS XML feed decoding
  
- 📊 **Sensor Metrics**:
  - Cloud cover
  - Present weather
  - Temperature, Dew Point, Humidex
  - Wind (True and Magnetic) Direction and Speed, Gusts and wind direction variability
  - Visibility(SM and M)
  - RWY24 RVR
  - Pressure: Altimeter, Density Altitude, Pressure Altitude
  - Lightning: Direction and location over the last hour
  - and many many more(TODO)  
    
- 🧭 **Navigation Controls**: (Holds up to 24 reports)
  - Ability to look at the first AWOS XML report in the current list.
  - Navigate forward and backward through previous AWOS XML reports (max of 24 reports)
  - View the latest report
  - Pause the server refresh countdown so looking at previous reports doesn't get overwritten by       the newest report
      
- 🌙 **Dark Mode Toggle**: UI theme switcher
  
- 🧰 **PowerShell Launcher**: Cross-platform startup script
  
- 🛠️ **Modular Architecture**: Clean separation of data, UI, and control logic
  

## 🛠️ Tech Stack

  - **Frontend**: HTML/CSS/JavaScript
  - **Backend**: Node.js with Express
  - **Logging**: Winston
  - **Scripts**: PowerShell 7
  - **Data Source**: AWOS XML + METAR/TAF feeds



## 📦 Installation

 *PREREQUISITES*

  In order to successfully run the server you need:
  -the latest version of Powershell(v7)
  -latest LTS version of Node.js with Express. 
  -npm. If npm is missing it can be installed manually.
  -Winston package/module for logging purposes.
  

To install the server using Bash:

-git clone https://github.com/Weedman4201985/Modern-AWOS.git
-cd Modern-AWOS
-npm install
-Install prerequisites

To run the server using BASH:
-Navigate to the Modern-AWOS root folder
-Type node ./server.js

To install and run the server using the built in Powershell launcher/Dashboard:

-git clone https://github.com/Weedman4201985/Modern-AWOS.git
-Install prerequisites
-Open powershell, type: cd Modern-AWOS(or wherever you cloned it to)
                         ./launcher.ps1                         
-In the Dashboard
  Choose option 1(Server Control Options)
    -Choose option 1 (Launch server)                    
                    
Once installed, you can create a desktop link to the launcher/dashboard(RECOMMENDED)
-Create a Desktop shorcut
-Set TARGET to "C:\Path\to\pwsh.exe" -ExecutionPolicy Bypass -NoExit -File "Path/to/the/launcher/launcher.ps1"




To view the server and any other server routes type the following into your web browser of choice:

localhost:3000 - Main AWOS page
localhost:3000/latest-awos - Latest RAW XML data report from the XMCN64 CYTR MET bulletin
localhost:3000/awos-history - Displays a history of parsed XML data reports(up to 24)
localhost:3000/raw-xml(not currently functioning correctly) - Displays parsed XML data in an attempt to remove placeholders and garbage from the XML report





🧪 Development Notes
-Built in ~36 hours of focused development
-Designed for local deployment and rapid refresh
-Desgined to be less cumbersome and more "up-to-date" then the legacy default AWOS server
-Modular and extensible for additional stations or sensors

📸 Screenshots

MAIN PAGE:

![AWOS main page](https://github.com/user-attachments/assets/81be0de7-9526-402d-a5db-1d4bcbe46f7f)

METAR/TAF Viewer:

![METAR_TAF_MODAL](https://github.com/user-attachments/assets/d4e2cd01-a7ad-4fe2-9555-8b4cf50d74b2)

Full Data Viewer(Parsed, non-essential data):

![Full_data_modal](https://github.com/user-attachments/assets/85b1d0ff-30c6-463d-9f5f-7b5e37cd3020)

XML Viewer:

![XML_Modal](https://github.com/user-attachments/assets/afdc4e1a-f257-4ab9-85a9-1b02c7794d4c)

Dark Mode:

![Dark_Mode](https://github.com/user-attachments/assets/cc55218a-1572-4958-a28e-efefdc6fa032)


📸 Launcher Screenshots

Main Menu:
<img width="538" height="522" alt="PSlauncher_dashboard" src="https://github.com/user-attachments/assets/8cf2cee9-6c5a-42ac-9b01-e9089fa5ecfa" />

Server Control Menu:

<img width="534" height="511" alt="Server control menu" src="https://github.com/user-attachments/assets/e38edc90-f88c-4e21-9879-ed5824d4c1d2" />

Log viewer:

<img width="537" height="519" alt="log viewer" src="https://github.com/user-attachments/assets/5261970d-a3ff-4b06-b6ec-b7b30352addb" />






📬 Contact
For questions or feedback, open an issue, reach out via GitHub or contact me at chris.pyatt@forces.gc.ca

Contact
For questions or feedback, open an issue or reach out via GitHub.
