<html>  
<head>  
<title>Sumar</title>  
</head>  

<body>  

	<?php 
	$valor1 = $_GET['T1']; 
	$valor2 = $_GET['T2']; 
	$valor3 = $_GET['T3']; 

	$suma = $valor1 + $valor2 + $valor3; 

	echo "$valor1 + $valor2 + $valor3 = $suma"; 
	?> 

</body> 
</html>