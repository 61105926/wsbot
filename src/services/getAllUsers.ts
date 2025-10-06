import axios from "axios";

interface ResponseAPI {
  data: DataAPI;
}

interface DataAPI {
  fullName: string;
  empID: string;
  phone: string;
  jwt: string;
}

interface Data {
  fullName: string;
  empID: string;
  phone: string;
  linkURL: string;
}

const URL = "http://190.171.225.68/api/survey";
export async function getAllUsers(): Promise<Data[]> {
  try {
    return await axios
      .get(URL)
      .then(async (res) => (await res.data) as ResponseAPI[])
      .then((items) => {
        return items.map((item) => ({
          fullName: item.data.fullName,
          empID: item.data.empID,
          phone: `591${item.data.phone}`,
          linkURL: item.data.jwt,
        }));
      });
  } catch (error) {
    throw error;
  }
}
