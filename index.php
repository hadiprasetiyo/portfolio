<!DOCTYPE HTML>
<html>
	<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title>Portfolio | Hadi Prasetiyo</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="" />
	<meta name="keywords" content="" />
	<meta name="author" content="" />

  <!-- Facebook and Twitter integration -->
	<meta property="og:title" content=""/>
	<meta property="og:image" content=""/>
	<meta property="og:url" content=""/>
	<meta property="og:site_name" content=""/>
	<meta property="og:description" content=""/>
	<meta name="twitter:title" content="" />
	<meta name="twitter:image" content="" />
	<meta name="twitter:url" content="" />
	<meta name="twitter:card" content="" />

	<!-- Place favicon.ico and apple-touch-icon.png in the root directory -->
	<link rel="shortcut icon" href="favicon.ico">
  <link rel="shortcut icon" href="images/icon.png" type="image/x-icon">

	<link href="https://fonts.googleapis.com/css?family=Quicksand:300,400,500,700" rel="stylesheet">
	<link href="https://fonts.googleapis.com/css?family=Playfair+Display:400,400i,700" rel="stylesheet">
	
	<!-- Animate.css -->
	<link rel="stylesheet" href="css/animate.css">
	<!-- Icomoon Icon Fonts-->
	<link rel="stylesheet" href="css/icomoon.css">
	<!-- Bootstrap  -->
	<link rel="stylesheet" href="css/bootstrap.css">
	<!-- Flexslider  -->
	<link rel="stylesheet" href="css/flexslider.css">
	<!-- Flaticons  -->
	<link rel="stylesheet" href="fonts/flaticon/font/flaticon.css">
	<!-- Owl Carousel -->
	<link rel="stylesheet" href="css/owl.carousel.min.css">
	<link rel="stylesheet" href="css/owl.theme.default.min.css">
	<!-- Theme style  -->
	<link rel="stylesheet" href="css/style.css">
	<!-- CDN Font Awesome -->
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"/>

	<!-- Modernizr JS -->
	<script src="js/modernizr-2.6.2.min.js"></script>
	<!-- FOR IE9 below -->
	<!--[if lt IE 9]>
	<script src="js/respond.min.js"></script>
	<![endif]-->

	</head>
	<body class="scrolling">
	<div id="colorlib-page">
		<div class="container-fluid">
		<a href="#" class="js-colorlib-nav-toggle colorlib-nav-toggle" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar"><i></i></a>
		<aside id="colorlib-aside" role="complementary" class="border js-fullheight scrolling">
			<div class="text-center">
				<div class="author-img" style="background-image: url(images/hadiiyok.jpg);"></div>
				<h1 id="colorlib-logo"><a href="index.html">Hadi Prasetiyo</a></h1>
				<span class="position"><a href="#">Fullstack Web Developer</a><br>Indonesia</span>
			</div>
			
			<nav id="colorlib-main-menu" role="navigation" class="navbar">
				<div id="navbar" class="collapse" >
					<ul>
						<li class="active"><a href="?hal=home" data-nav-section="home">Home</a></li>
						<li><a class="nav-link" href="?hal=about" data-nav-section="about">About</a></li>
						<li><a class="nav-link" href="?hal=services" data-nav-section="services">Services</a></li>
						<li><a class="nav-link" href="?hal=skills" data-nav-section="skills">Skills</a></li>
						<li><a class="nav-link" href="?hal=education" data-nav-section="experience">Education</a></li>
						<li><a class="nav-link" href="?hal=project" data-nav-section="work">Project</a></li>
						<li><a class="nav-link" href="?hal=blog" data-nav-section="blog">Blog</a></li>
						<li><a class="nav-link" href="?hal=contact" data-nav-section="contact">Contact</a></li>
					</ul>
				</div>
			</nav>

			<div class="colorlib-footer">
				<p><small>&copy; <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
Copyright <script>document.write(new Date().getFullYear());</script><br>Made with <i class="icon-heart" aria-hidden="true"></i> by <a href="https://github.com/hadiprasetiyo?tab=overview&from=2022-12-01&to=2022-12-26" target="_blank">Hadi Prasetiyo</a><br>
All rights reserved. 



</div>

		</aside>

		<div id="colorlib-main">
			<!-- home -->
			<?php
        // tangkap request di URL
        if (isset($_REQUEST['hal'])) {
          $hal = $_REQUEST['hal'];
          if (!empty($hal)) {
            include_once $hal. '.php';
          }
        } else {
          include_once 'home.php';
        }
      ?>

		</div><!-- end:colorlib-main -->
	</div><!-- end:container-wrap -->
	</div><!-- end:colorlib-page -->

	<!-- jQuery -->
	<script src="js/jquery.min.js"></script>
	<!-- jQuery Easing -->
	<script src="js/jquery.easing.1.3.js"></script>
	<!-- Bootstrap -->
	<script src="js/bootstrap.min.js"></script>
	<!-- Waypoints -->
	<script src="js/jquery.waypoints.min.js"></script>
	<!-- Flexslider -->
	<script src="js/jquery.flexslider-min.js"></script>
	<!-- Owl carousel -->
	<script src="js/owl.carousel.min.js"></script>
	<!-- Counters -->
	<script src="js/jquery.countTo.js"></script>
	<!-- MAIN JS -->
	<script src="js/main.js"></script>
	
	</body>
</html>


