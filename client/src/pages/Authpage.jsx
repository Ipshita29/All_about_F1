import {useState} from "react";

function AuthPage(){
  const [isLogin,setisLogin]=useState(true)
  const [name,setName]=useState("")
  const [email,setEmail]=useState("")
  const [password,setPassword] = useState("")
  const handleLogin = async()=>{
    try{
      const response= await fetch("http://localhost:3000/auth/login",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({email,password})
      })
      const data = await response.json()
      console.log("STATUS:", response.status);
      console.log("DATA:", data);
      if (data.token){
        localStorage.setItem("token", data.token);
        window.location.href = "/";
      }else{
        alert(data.message);
      }
    }
    catch(e){
      console.log(e)
    }
  }
  const handleSignup = async () => {
    try {
      const response = await fetch("http://localhost:3000/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token",data.token)
        window.location.href = "/preferences";
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.log(error);
    }
  }
  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "50px auto",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
      }}
    >
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>

      {!isLogin && (
        <div style={{ marginBottom: "10px" }}>
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>
      )}

      <div style={{ marginBottom: "10px" }}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      <button
        onClick={isLogin ? handleLogin : handleSignup}
        style={{
          width: "100%",
          padding: "10px",
          cursor: "pointer",
        }}
      >
        {isLogin ? "Login" : "Sign Up"}
      </button>

      <p style={{ marginTop: "15px", textAlign: "center" }}>
        {isLogin ? (
          <>
            Don't have an account?{" "}
            <span
              style={{ color: "blue", cursor: "pointer" }}
              onClick={() => setisLogin(false)}
            >
              Sign Up
            </span>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <span
              style={{ color: "blue", cursor: "pointer" }}
              onClick={() => setisLogin(true)}
            >
              Login
            </span>
          </>
        )}
      </p>
    </div>
  );

}
export default AuthPage;