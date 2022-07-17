<html>  
<head>  
<title>Sumar</title>  
</head>  

<body>  

	<?php 
	$valor1 = $_POST['T1']; 
	$valor2 = $_POST['T2']; 
	$valor3 = $_POST['T3']; 

	$suma = $valor1 + $valor2 + $valor3; 

	echo "$valor1 + $valor2 + $valor3 = $suma"; 
	?> 

</body> 
</html>