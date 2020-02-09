public class Symbol {
	public int number;
	public Surprise surprise;

	public Symbol(int number){setNumber(number)}

	public Symbol(Surprise surprise){setSurprise(surprise)}

	public boolean isNumber(){
		return number != null;
	}

	public void setNumber(int number){
		this.number = number;
		this.surprise = null;
	}

	public int getNumber(){
		return number;
	}

	public void setSurprise(Surprise surprise){
		this.number = null;
		this.surprise = surprise;
	}

	public int getSurpise(){
		return surprise;
	}
}