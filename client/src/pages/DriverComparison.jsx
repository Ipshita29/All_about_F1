import { useState, useEffect } from "react";

function DriverComparison() {
    const [drivers, setDrivers] = useState([]);
    const [driver1, setDriver1] = useState("");
    const [driver2, setDriver2] = useState("");
    const [year, setYear] = useState("2026");
    const [standings,setStandings] = useState([]);

    const selectedDriver1 = drivers.find(
    (driver) => driver.driverId === driver1
    );

    const selectedDriver2 = drivers.find(
        (driver) => driver.driverId === driver2
    );

    const standing1 = standings.find(
        (ele)=>ele.Driver.driverId === driver1
    );

    const standing2 = standings.find(
        (ele)=>ele.Driver.driverId === driver2
    );

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/${year}`)
            .then((res) => res.json())
            .then((data) => setDrivers(data));

    }, [year]);

    useEffect(()=>{
            fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res)=>res.json())
            .then((data)=>setStandings(data));

        },[year]);

    console.log(drivers);

    return (
        <div className="page">
            <h1>Driver Comparison</h1>
            <select
                value={year}
                onChange={(e)=>setYear(e.target.value)}
            >
                <option value="2020">2020</option>
                <option value="2021">2021</option>
                <option value="2022">2022</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
            </select>

            <br /><br />
            <select
                value={driver1}
                onChange={(e)=>setDriver1(e.target.value)}
            >
                <option value="">
                    Select Driver 1
                </option>

                {drivers.map((driver)=>(
                    <option
                        key={driver.driverId}
                        value={driver.driverId}
                    >
                        {driver.givenName} {driver.familyName}
                    </option>
                ))}
            </select>
            <br /><br />

            <select
                value={driver2}
                onChange={(e)=>setDriver2(e.target.value)}
            >
                <option value="">
                    Select Driver 2
                </option>

                {drivers.map((driver)=>(
                    <option
                        key={driver.driverId}
                        value={driver.driverId}
                    >
                        {driver.givenName} {driver.familyName}
                    </option>
                ))}
            </select>
            <br /><br />

            {selectedDriver1 && selectedDriver2 && (

            <div className="card">

                <h2>Driver Comparison</h2>

                <table>

                    <thead>
                        <tr>
                            <th>Category</th>

                            <th>
                                {selectedDriver1.givenName}
                                {" "}
                                {selectedDriver1.familyName}
                            </th>


                            <th>
                                {selectedDriver2.givenName}
                                {" "}
                                {selectedDriver2.familyName}
                            </th>
                        </tr>
                    </thead>

                    <tbody>

                        <tr>
                            <td>Nationality</td>
                            <td>{selectedDriver1.nationality}</td>
                            <td>{selectedDriver2.nationality}</td>
                        </tr>

                        <tr>
                            <td>Number</td>
                            <td>{selectedDriver1.permanentNumber}</td>
                            <td>{selectedDriver2.permanentNumber}</td>
                        </tr>

                        <tr>
                            <td>Date Of Birth</td>
                            <td>{selectedDriver1.dateOfBirth}</td>
                            <td>{selectedDriver2.dateOfBirth}</td>
                        </tr>

                        <tr>
                            <td>Code</td>
                            <td>{selectedDriver1.code}</td> 
                            <td>{selectedDriver2.code}</td>
                        </tr>
                        <tr>
                            <td>Position</td>
                            <td>{standing1?.position}</td>
                            <td>{standing2?.position}</td>
                        </tr>

                        <tr>
                            <td>Points</td>
                            <td>{standing1?.points}</td>
                            <td>{standing2?.points}</td>
                        </tr>

                        <tr>
                            <td>Wins</td>
                            <td>{standing1?.wins}</td>
                            <td>{standing2?.wins}</td>
                        </tr>

                        <tr>
                            <td>Team</td>
                            <td>{standing1?.Constructors?.[0]?.name}</td>
                            <td>{standing2?.Constructors?.[0]?.name}</td>
                        </tr>

                    </tbody>

                </table>

            </div>

)}
        </div>
    );
}

export default DriverComparison;