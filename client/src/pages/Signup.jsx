import { useState } from "react";

function Signup(){

    const [name,setName] = useState("");
    const [email,setEmail] = useState("");
    const [password,setPassword] = useState("");

    const handleSignup = async () => {

        const response = await fetch(
            "http://localhost:3000/auth/signup",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        console.log(data);
        alert("Signup successful")

    }

    return(
        <div className="auth-page">
            <div className="auth-card">
                <h1>Sign Up</h1>
                <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e)=>setName(e.target.value)}
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                />
                <button onClick={handleSignup}>Create Account</button>
            </div>
        </div>
    )

}

export default Signup;
