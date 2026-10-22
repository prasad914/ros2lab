# Certificate template changes (v2)

The template is the site's own renderer, `public/js/cert-render.js` + `public/css/certificate.css`. Keep it; only these changes:

1. `functions/config.js`: `CERT_INSTRUCTOR = "Robotics & ROS 2 Lab"`, `CERT_INSTRUCTOR_TITLE = "Course team, ROS2Lab"` (owner decision: no personal name for now). Already-signed certificates keep their stored values.
2. `cert-render.js` seal ring text: `"ROS2LAB • NOT YET VALIDATED • ROS 2 JAZZY •"` → `"ROBOTICS & ROS 2 LAB • ROS2LAB • ROS 2 JAZZY •"`.
3. `cert-render.js` statement: `"offered by ROS2Lab, having passed all graded assessments and an individually assigned capstone project."` → `"offered by ROS2Lab from the Robotics & ROS 2 Lab YouTube channel, having passed every weekly test and an individually assigned capstone project."`
4. `js/index.js` sample certificate: `instructor: "Robotics & ROS 2 Lab", instructorTitle: "Course team, ROS2Lab"`.
5. certificate.html (Verify page): restyle the page around the certificate in the site theme (pagehead "Verify a certificate", ID field + Check, status box, Download PDF / Add to LinkedIn / Copy link). Keep the ID format `R2L-YYYY-XXXXXXXXXX`, the messages and the LinkedIn URL exactly as they are.

`certview.js` here is only the prototype glue that draws the sample; do not copy it into the site.
